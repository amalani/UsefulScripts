# contacts-sync

Apps Script tools for keeping two Google contact books tidy:

- **Account A**: primary, ~1200 contacts, has duplicates, holds extra email-only contacts.
- **Account B**: phone-sync book shared with a spouse, ~900 contacts. Treated as the source of truth for addresses/phones.

The same `src/` is deployed as **two separate script projects** (one per account).

## What exists so far

| Function | What it does |
|---|---|
| `backupContacts()` | Dumps every contact + label names to a JSON file in Drive folder `ContactsBackup` (keeps newest 12). |
| `dedupeDryRun()` | Changes nothing. Writes proposed merges to a Sheet named "Contacts Dedupe Review". |
| `dedupeApply()` | Backs up, then merges only the HIGH-confidence groups. Safe to re-run (resumes). |

**HIGH** = share an email or phone *and* names are compatible, or one has no name. Merged automatically.
**REVIEW** = same name but nothing else in common, or shared email/phone with conflicting names (e.g. a family landline). Never auto-merged.

Merge keeps the richest contact, unions emails/phones/addresses/orgs/labels, and concatenates distinct notes.

## B → A sync

B is the source of truth for names, phones, addresses, orgs and birthdays. A mirrors them. Notes, labels,
and A-only contacts are never touched, and emails are only ever added to, not removed. Nothing is written to B.

| Where | Function | What it does |
|---|---|---|
| **B** | `exportForSync()` | Writes the owned fields to one Drive file (`b-contacts-sync-export.json`), overwritten each run. |
| **A** | `syncDryRun()` | Changes nothing. Writes the plan to the "Contacts Sync Review" Sheet (tabs: Plan, Summary). |
| **A** | `syncApply()` | Backs up, then applies the plan. Safe to re-run. |
| B / A | `installWeeklyExportTrigger()` / `installWeeklySyncTrigger()` | Weekly triggers (Mon ~5am export in B, ~6am sync in A). Install only after a dry run looks right. |

Plan actions: **UPDATE** (linked, fields differ), **LINK** (unlinked A contact matched to a B contact by shared
email/phone with a compatible name; gets a `B_SYNC` external ID), **CREATE** (no A match), **REVIEW** (ambiguous,
or same name with nothing else shared; never written), **REMOVED** (linked A contact whose B contact is gone;
gets the "Removed from B" label, never deleted).

Safety stops (errors, nothing written): export older than 14 days, would create more than 100 contacts, export
has under half the linked contacts, or over 10% of linked contacts vanished from B. Limits are in `Config.js`.

First-time setup:
1. In **B**: run `exportForSync()`. Open the logged Drive URL and share the file with **A** as Viewer (once).
2. In **A**: run `syncDryRun()` and read the Sheet. Run `syncApply()` when happy (it may take a few runs; each run is capped at 400 writes).
3. Run `syncDryRun()` again: UPDATE should be near zero. If the same contacts keep showing UPDATE, tell me what the Changes column says.
4. Install the two weekly triggers.

## Order of use

1. Run `backupContacts()` in both accounts.
2. Run `dedupeDryRun()` in **A**. Read the Sheet. Then `dedupeApply()`.
3. Optionally the same in **B** (dry run only at first; merging in B changes your spouse's phone book too).

## Setup with clasp (push from this repo)

clasp is not installed here; `npx` works without installing. The project root is `contacts-sync/`
(clasp refuses a `rootDir` outside the folder holding its config), with one git-ignored config file
per account: `.clasp.A.json` and `.clasp.B.json`, both pointing at `src/`.

One-time, per Google account: turn on the Apps Script API at https://script.google.com/home/usersettings

```bash
cd contacts-sync
npx @google/clasp -u A login
npx @google/clasp -u A create-script --type standalone --title "Contacts Tools (A)" --rootDir src
mv .clasp.json .clasp.A.json
npx @google/clasp -u A -P .clasp.A.json push
```

Then repeat for B (log in as account B in the browser):

```bash
npx @google/clasp -u B login
npx @google/clasp -u B create-script --type standalone --title "Contacts Tools (B)" --rootDir src
mv .clasp.json .clasp.B.json
npx @google/clasp -u B -P .clasp.B.json push
```

Gotchas: `create-script` overwrites `src/appsscript.json` with a bare default (dropping the People service),
so run `git checkout -- src/appsscript.json` right after it (stage your manifest edits first), and push with `--force`
the first time since there is no prompt in a script. Always pass `-u A` / `-u B` to `create-script`; a project made
under the wrong account gives "The caller does not have permission" on push.

Later pushes: `npx @google/clasp -u A -P .clasp.A.json push` (or `B`). To open a project in the browser,
swap `push` for `open-script`. Then pick a function and Run; the first run asks for permissions.

Not using clasp? Create a project at script.google.com, paste each `src/*.js` file in, and
replace the manifest with `src/appsscript.json` (View > Show manifest file).

## Caveats

- The People API delete may not be recoverable from Contacts' trash. Treat the Drive backup as your undo.
- Dry-run first, always. Skim the REVIEW rows too; they show contacts worth merging by hand.
- Adjust `CONFIG` in `src/Config.js` (batch size, phone-digit matching, backup retention).
- Set `timeZone` in `src/appsscript.json` to yours.
