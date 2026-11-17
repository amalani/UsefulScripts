# gmail-audit

A Google Sheet, driven by Apps Script, that shows who is filling your mailbox: one row per sender with counts,
size, first/last date and a per-year breakdown. You use it to decide what to unsubscribe from or delete, and it
re-counts senders as you clean up.

**Read-only.** The script only has the `gmail.readonly` scope. It never deletes, archives or labels mail; you do
the cleanup in Gmail and the sheet keeps score. Only headers are read (From, List-Unsubscribe, date, size, labels), never bodies.

## The sheets

**Senders** (the one you work in), one row per sender address:

| Column | Meaning |
|---|---|
| Refresh? | Tick after you have cleaned a sender up, then run *Refresh checked rows* |
| Sender / Name / Domain | Address, newest display name, root domain (`e.news.shopify.com` becomes `shopify.com`) |
| In inbox | Messages still carrying the Inbox label |
| All mail | Everything except Spam and Trash. Archiving lowers *In inbox* only; deleting lowers both |
| Size (MB) | Sum of Gmail's size estimate for those messages |
| First / Last | Oldest and newest message |
| Newsletter | `Y` if any message had a `List-Unsubscribe` header (reliably separates mailing lists from people) |
| Action | Your own note: Keep / Unsubscribe / Delete (a dropdown; the script never acts on it) |
| 2004 ... this year | Messages per year |

Senders that reach 0 grey out but stay, so your Action notes survive. A one-click filter is already on the header row.

**Domains**: a formula roll-up of Senders by root domain (senders, counts, size, first, last). It recalculates by itself.
**Status**: progress of the current or last scan.

## Menu: Gmail Audit

| Item | What it does |
|---|---|
| Set up sheets | Creates/repairs the three tabs. Safe to repeat |
| Start initial scan | Counts every message, newest first. Works in ~5 minute chunks and re-triggers itself each minute until done |
| Refresh checked rows | Re-counts only the ticked senders, straight from Gmail, then unticks them |
| Add new mail since last run | Adds only mail newer than the last counted message to the existing totals |
| Scan status / Stop scan | Progress, or cancel the current scan |
| Full rebuild... | Zeroes the counts (rows and Action notes kept) and scans everything again |

How the three modes fit together:
- *Add new mail* only ever adds, so deletions you made by hand do not show up until you tick the sender and refresh it.
- *Refresh checked rows* re-measures every remaining message when a sender has up to `REFRESH_EXACT_MAX` (1500) of them.
  Above that, counts are still exact but Size is scaled from the previous value, and the alert says which senders.
- If totals drift (for example after bulk deleting during the initial scan), *Full rebuild* is the reset button.

## Setup with clasp

Same pattern as `contacts-sync`. The script is **bound to a new Sheet**, which clasp creates for you.

One-time: turn on the Apps Script API at https://script.google.com/home/usersettings

```bash
cd gmail-audit
npx @google/clasp login
npx @google/clasp create --type sheets --title "Gmail Audit" --rootDir src
git checkout -- src/appsscript.json     # create overwrites the manifest with a bare default
npx @google/clasp push --force          # first push needs --force (no prompt in a script)
npx @google/clasp open-container        # opens the new Sheet
```

Reload the Sheet and a **Gmail Audit** menu appears. Run **Set up sheets**, then **Start initial scan**. The first
run asks for permissions (read Gmail, edit the sheet, connect to an external service, run triggers).
Not using clasp? Open Extensions > Apps Script in any Sheet, paste each `src/*.js` in, and replace the manifest
(Project Settings > Show appsscript.json) with `src/appsscript.json`. Set `timeZone` in it to yours.

## Things to know

- **Speed and rate limits.** Metadata is fetched through Gmail's batch endpoint, 40 messages per request, paced to
  `MAX_GETS_PER_MIN` (default 1500, about 7,500 quota units a minute) because Gmail enforces a per-user per-minute
  quota. At that pace 80,000 messages is roughly an hour spread over ~12 chunks. Apps Script allows 90 minutes of
  trigger runtime per day on a free account, so leave the default unless runs are clean. If Gmail still throttles,
  the run backs off, ends cleanly, keeps its progress and the next chunk resumes (the Status tab shows
  "rate-limited parts"). Only tested against a simulated mailbox so far.
- **Do not clean up while the initial scan runs.** Deleting or archiving during it can make the paging skip or repeat a few
  messages. Anything off is fixed by refreshing that sender.
- **One sender, many addresses.** Newsletters that rotate addresses (`news-4821@...`) show as many rows; the Domains tab groups them.
- **Spam and Trash are not counted.**
- **Years** are by the message's received date, in the script's time zone. Per-year counts in a large-sender refresh use
  Gmail's `after:`/`before:` dates, which can differ by a day at year boundaries.
- Tune batch size, time budget and the refresh threshold in `src/Config.js`.
- Scan state lives in Script Properties; the counts live in the sheet. Deleting the sheet's data without *Full rebuild* will confuse the cursor.
