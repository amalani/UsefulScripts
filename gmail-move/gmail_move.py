#!/usr/bin/env python3
"""Move mail matching Gmail searches from a SOURCE Gmail account to a DESTINATION account.

Copy (users.messages.import, keeps original sender/date/body) then trash the source copy.
Config (filters + limits) is a JSON file, see filters.example.json. Default is a dry run;
--execute moves for real; --auto is the unattended mode used by the scheduler.
"""
import argparse, base64, io, json, os, sys
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

HERE = Path(__file__).parent
# credentials.json, token_*.json and moved.json live here (keep OUT of git; mount as a volume on a NAS)
DATA = Path(os.environ.get("GMAIL_MOVE_DATA", HERE))
SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]
STATE_FILE = DATA / "moved.json"  # source msg id -> dest msg id (makes re-runs safe)
DEFAULT_MAX_PER_RUN, DEFAULT_MAX_MB = 200, 500
NON_INTERACTIVE = False


def service(role):
    token = DATA / f"token_{role}.json"
    creds = Credentials.from_authorized_user_file(str(token), SCOPES) if token.exists() else None
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if NON_INTERACTIVE:
                sys.exit(f"{role} token missing/expired: sign in again interactively and copy token_{role}.json here")
            print(f"\nSign in as the {role.upper()} account in the browser window...")
            flow = InstalledAppFlow.from_client_secrets_file(str(DATA / "credentials.json"), SCOPES)
            creds = flow.run_local_server(port=0)
        token.write_text(creds.to_json())
    svc = build("gmail", "v1", credentials=creds, cache_discovery=False)
    email = svc.users().getProfile(userId="me").execute(num_retries=5)["emailAddress"]
    print(f"{role}: {email}")
    return svc, email


def load_state():
    return json.loads(STATE_FILE.read_text()) if STATE_FILE.exists() else {}


def save_state(state):
    STATE_FILE.write_text(json.dumps(state))


def list_ids(svc, query, limit):
    ids, token = [], None
    while True:
        r = svc.users().messages().list(userId="me", q=query, pageToken=token, maxResults=500).execute(num_retries=5)
        ids += [m["id"] for m in r.get("messages", [])]
        token = r.get("nextPageToken")
        if not token or (limit and len(ids) >= limit):
            break
    return ids[:limit] if limit else ids


def get_label_id(dst, name, cache):
    if not cache:
        for l in dst.users().labels().list(userId="me").execute(num_retries=5)["labels"]:
            cache[l["name"]] = l["id"]
    if name not in cache:
        cache[name] = dst.users().labels().create(userId="me", body={"name": name}).execute(num_retries=5)["id"]
    return cache[name]


def dry_run(src, ids):
    total, sample = 0, []
    for i in range(0, len(ids), 100):
        batch = src.new_batch_http_request()
        def cb(_id, resp, exc):
            nonlocal total
            if exc: return
            total += resp.get("sizeEstimate", 0)
            if len(sample) < 8:
                h = {x["name"]: x["value"] for x in resp["payload"]["headers"]}
                sample.append(f'   {resp.get("sizeEstimate",0)/1e6:6.1f} MB  {h.get("From","")[:40]:40}  {h.get("Subject","")[:50]}')
        for mid in ids[i:i+100]:
            batch.add(src.users().messages().get(userId="me", id=mid, format="metadata",
                      metadataHeaders=["From", "Subject"]), callback=cb)
        batch.execute()
    print(f"  {len(ids)} messages, ~{total/1e6:.1f} MB")
    print("\n".join(sample))


def move_one(src, dst, mid, flt, state, label_cache):
    """Returns bytes copied (0 if it had already been copied earlier)."""
    size = 0
    if mid not in state:
        raw = src.users().messages().get(userId="me", id=mid, format="raw").execute(num_retries=5)
        labels = [get_label_id(dst, flt["label"], label_cache)]
        if "UNREAD" in raw.get("labelIds", []): labels.append("UNREAD")
        if "STARRED" in raw.get("labelIds", []): labels.append("STARRED")
        if flt.get("inbox"): labels.append("INBOX")
        data = base64.urlsafe_b64decode(raw["raw"])
        size = len(data)
        media = MediaIoBaseUpload(io.BytesIO(data), mimetype="message/rfc822", resumable=size > 4_000_000)
        res = dst.users().messages().import_(
            userId="me", body={"labelIds": labels}, media_body=media,
            internalDateSource="dateHeader", neverMarkSpam=True).execute(num_retries=5)
        state[mid] = res["id"]
        save_state(state)
    src.users().messages().trash(userId="me", id=mid).execute(num_retries=5)
    return size


def parse_text_config(text):
    """Plain-text format: `key = value` caps, and `label | gmail query | [limit] [inbox]` rule lines. # = comment."""
    cfg = {"filters": []}
    for n, line in enumerate(text.splitlines(), 1):
        line = line.split(" #")[0].strip() if not line.lstrip().startswith("#") else ""
        if not line: continue
        if "|" not in line:
            k, _, v = line.partition("=")
            if not v: sys.exit(f"config line {n}: expected `label | query` or `key = value`")
            cfg[k.strip()] = int(v)
            continue
        parts = [p.strip() for p in line.split("|")]
        if len(parts) < 2 or not parts[0] or not parts[1]:
            sys.exit(f"config line {n}: need `label | query`")
        f = {"name": parts[0], "label": parts[0], "query": parts[1]}
        for tok in (parts[2].split() if len(parts) > 2 else []):
            if tok.isdigit(): f["limit"] = int(tok)
            elif tok == "inbox": f["inbox"] = True
            else: sys.exit(f"config line {n}: unknown option {tok!r} (use a number and/or `inbox`)")
        cfg["filters"].append(f)
    return cfg


def load_config(path):
    path = Path(path)
    cfg = json.loads(path.read_text()) if path.suffix == ".json" else parse_text_config(path.read_text())
    names = [f["name"] for f in cfg["filters"]]
    if len(names) != len(set(names)): sys.exit("duplicate filter names/labels in config")
    for f in cfg["filters"]:
        if not all(k in f for k in ("name", "query", "label")):
            sys.exit(f"filter needs name, query, label: {f}")
    return cfg


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", default=os.environ.get("GMAIL_MOVE_CONFIG", str(HERE / "filters.txt")),
                    help="filters file, .txt or .json (default: $GMAIL_MOVE_CONFIG or ./filters.txt)")
    ap.add_argument("--filter", action="append", help="run only this filter name (repeatable); default: all")
    ap.add_argument("--query", help="ad-hoc Gmail query instead of the config's filters (needs --label)")
    ap.add_argument("--label", help="destination label for --query")
    ap.add_argument("--max", type=int, help="override max_per_run (total messages this run)")
    ap.add_argument("--execute", action="store_true", help="actually move (default: dry run)")
    ap.add_argument("--auto", action="store_true", help="unattended: execute, never open a browser (scheduler)")
    ap.add_argument("--dry-run", action="store_true", help="with --auto: only report, don't move")
    ap.add_argument("--list", action="store_true", help="list configured filters and exit")
    a = ap.parse_args()

    cfg = load_config(a.config)
    if a.list:
        print(f'max_per_run={cfg.get("max_per_run", DEFAULT_MAX_PER_RUN)} max_mb_per_run={cfg.get("max_mb_per_run", DEFAULT_MAX_MB)}')
        for f in cfg["filters"]: print(f'{f["name"]:20} {f["query"]}  ->  {f["label"]}  limit={f.get("limit")}')
        return

    global NON_INTERACTIVE
    execute = a.execute
    if a.auto:
        NON_INTERACTIVE, execute = True, not a.dry_run
    if a.query:
        if not a.label: ap.error("--query requires --label")
        todo = [{"name": "adhoc", "query": a.query, "label": a.label}]
    else:
        by = {f["name"]: f for f in cfg["filters"]}
        missing = [n for n in (a.filter or []) if n not in by]
        if missing: ap.error(f"unknown filter(s): {missing}")
        todo = [by[n] for n in a.filter] if a.filter else cfg["filters"]

    max_msgs = a.max or cfg.get("max_per_run", DEFAULT_MAX_PER_RUN)
    max_bytes = cfg.get("max_mb_per_run", DEFAULT_MAX_MB) * 1_000_000

    src, src_email = service("source")
    dst, dst_email = service("dest")
    if src_email == dst_email:
        sys.exit("source and destination are the same account")
    state, label_cache = load_state(), {}
    done, done_bytes = 0, 0
    print(f'mode: {"EXECUTE" if execute else "dry run"}  caps: {max_msgs} msgs / {max_bytes/1e6:.0f} MB per run')

    for flt in todo:
        room = max_msgs - done
        if execute and (room <= 0 or done_bytes >= max_bytes):
            print(f'\n[{flt["name"]}] skipped: run cap reached'); continue
        limit = min(flt.get("limit") or room, room)
        print(f'\n[{flt["name"]}] {flt["query"]}')
        ids = list_ids(src, flt["query"], limit)
        if not execute:
            dry_run(src, ids); continue
        ok = fail = 0
        for n, mid in enumerate(ids, 1):
            if done_bytes >= max_bytes:
                print("  size cap reached, stopping"); break
            try:
                done_bytes += move_one(src, dst, mid, flt, state, label_cache); ok += 1; done += 1
            except Exception as e:
                fail += 1; print(f"  ! {mid}: {e}")
            if n % 25 == 0: print(f"  {n}/{len(ids)}")
        print(f"  moved {ok}, failed {fail}")
    if execute:
        print(f"\nTotal moved this run: {done} messages, {done_bytes/1e6:.1f} MB")
    else:
        print("\nDry run only. Re-run with --execute to move.")


if __name__ == "__main__":
    main()
