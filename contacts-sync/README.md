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
