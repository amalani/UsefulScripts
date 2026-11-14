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

Not built yet: the B → A sync (B-side export, A-side marker + sync).

## Order of use

1. Run `backupContacts()` in both accounts.
2. Run `dedupeDryRun()` in **A**. Read the Sheet. Then `dedupeApply()`.
3. Optionally the same in **B** (dry run only at first; merging in B changes your spouse's phone book too).

## Setup with clasp (push from this repo)

clasp is not installed here; `npx` works without installing. One-time, per Google account:

1. Turn on the Apps Script API for that account: https://script.google.com/home/usersettings
2. Log in as that account, then create and push its project:

```bash
cd contacts-sync/account-A
npx @google/clasp login --user A
npx @google/clasp create --type standalone --title "Contacts Tools (A)" --rootDir ../src
npx @google/clasp push --user A
```

Repeat in `account-B/` with `--user B` (log in as account B first). Each folder gets its own
`.clasp.json` (git-ignored) pointing at `../src`. Then open the project in the browser
(`npx @google/clasp open-script`), pick a function, and Run. The first run asks for permissions.

Not using clasp? Create a project at script.google.com, paste each `src/*.js` file in, and
replace the manifest with `src/appsscript.json` (View > Show manifest file).

## Caveats

- The People API delete may not be recoverable from Contacts' trash. Treat the Drive backup as your undo.
- Dry-run first, always. Skim the REVIEW rows too; they show contacts worth merging by hand.
- Adjust `CONFIG` in `src/Config.js` (batch size, phone-digit matching, backup retention).
- Set `timeZone` in `src/appsscript.json` to yours.
