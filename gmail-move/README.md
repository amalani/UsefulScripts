# gmail-move

Move mail from a **source** Gmail account to a **destination** one, selected by Gmail search filters
(sender, size, age, ...). Copies each message with `messages.import` (original sender/date preserved,
no forwarding), then moves the source copy to Trash (recoverable for 30 days).

## Config: one text file, one command
Copy `filters.example.txt` to `filters.txt` (git-ignored here) or keep it in a **private repo**. One rule per line:

```
max_per_run = 200        # total messages per run, all rules combined (default 200)
max_mb_per_run = 500     # total size per run (default 500)

# label (applied at destination) | gmail query | optional: limit and/or `inbox`
moved/big         | larger:10M older_than:30d              | 100
moved/newsletters | from:(a@x.com OR b@y.org)
```
Anything you can type in the Gmail search box works as the query. A number caps that one rule; `inbox` lands
moved mail in the destination Inbox instead of archiving it under the label. `#` starts a comment. Rules run in
order, so put the most valuable first; once a run cap is hit the rest wait for the next run. (`.json` configs
also still work.)

```bash
.venv/bin/python gmail_move.py                # dry run of ALL filters (counts, size, sample)
.venv/bin/python gmail_move.py --execute      # move for real, all filters
.venv/bin/python gmail_move.py --filter moved/big   # just one rule (rules are named by their label)
.venv/bin/python gmail_move.py --query "from:foo@bar.com" --label moved/foo
```
Re-running is safe: `moved.json` records copied messages, so nothing is duplicated; unread/starred are kept.

## One-time setup (do this on a machine with a browser)
1. https://console.cloud.google.com: create a project, enable the **Gmail API**.
2. OAuth consent screen: External; add both Gmail addresses as test users, then publish to
   **In production** (stays unverified, fine for personal use) so refresh tokens don't expire after 7 days.
3. Credentials -> **OAuth client ID** -> *Desktop app*; save the JSON as `credentials.json`.
4. `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`
5. `.venv/bin/python gmail_move.py` - browser opens twice (source, then destination) and writes
   `token_source.json` / `token_dest.json`.

## Unattended (cron / launchd / NAS)
`run_auto.sh` = `git pull` (optional) -> run all filters with `--auto` (executes, never prompts, lock
prevents overlapping runs) -> log to `auto.log`. Environment variables:

| var | meaning |
|---|---|
| `CONFIG_REPO` | path to a checkout of your private repo containing `filters.txt`; pulled before every run |
| `SELF_UPDATE=1` | `git pull` the repo this script lives in first (use if the whole script is in your private repo) |
| `GMAIL_MOVE_DATA` | dir holding `credentials.json`, tokens, `moved.json`, `auto.log` (default: script dir). Keep out of git |

**NAS / headless:** do the setup above on your Mac, then copy `credentials.json`, `token_source.json`,
`token_dest.json` into the NAS data dir. Cron example (daily 03:00):
```
0 3 * * * CONFIG_REPO=/volume1/gmail-move-config GMAIL_MOVE_DATA=/volume1/gmail-move-data /volume1/gmail-move/run_auto.sh
```
(Use a deploy key or token so `git pull` works non-interactively.)

**macOS:** `CONFIG_REPO=~/gmail-move-config ./schedule.sh [HOUR]` installs a daily launchd job;
`./schedule.sh --remove` removes it.

Preview what the scheduler would do without moving anything: `.venv/bin/python gmail_move.py --auto --dry-run`.
If a token ever expires, `auto.log` says so; re-run step 5 and copy the new token over.
