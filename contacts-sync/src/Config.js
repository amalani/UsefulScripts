/**
 * Shared settings for the contacts tools. The same code is deployed to both
 * Google accounts (A = primary, B = phone/shared); each runs in its own account.
 */
const CONFIG = {
  // Backups: JSON snapshots written to this Drive folder (created if missing).
  BACKUP_FOLDER: 'ContactsBackup',
  BACKUP_KEEP: 12, // newest N snapshots are kept, older ones trashed

  // Matching
  MIN_PHONE_DIGITS: 7,    // ignore shorter numbers (extensions, short codes)
  PHONE_MATCH_DIGITS: 10, // compare the last N digits, so +1 / country codes don't matter

  // Apply safety
  MAX_MERGES_PER_RUN: 200,         // groups merged per dedupeApply() run
  TIME_BUDGET_MS: 5 * 60 * 1000,   // stop before Apps Script's 6 min limit; just re-run
  PAUSE_MS: 250,                   // between writes, to stay under People API quotas

  REVIEW_SPREADSHEET_NAME: 'Contacts Dedupe Review',

  // ---- B -> A sync ----
  SYNC_FOLDER: 'ContactsSync',                      // in B's Drive; holds the export file
  SYNC_EXPORT_NAME: 'b-contacts-sync-export.json',  // B writes it, A finds it by name once shared
  SYNC_EXPORT_MAX_AGE_DAYS: 14,                     // refuse to sync from a staler export
  SYNC_MARKER_TYPE: 'B_SYNC',                       // externalIds type that links an A contact to its B contact
  SYNC_REMOVED_LABEL: 'Removed from B',             // label put on A contacts whose B contact is gone
  SYNC_CREATE_NEW: true,                            // create in A the B contacts that have no A match
  SYNC_NAME_ONLY: 'review',                         // same name, nothing else shared: 'review' or 'link'
  SYNC_MAX_WRITES: 400,                             // contact writes per syncApply() run; re-run for the rest
  SYNC_MAX_CREATES: 100,                            // abort if one run would create more than this
  SYNC_MAX_REMOVE_FRACTION: 0.1,                    // abort if more than this share of linked contacts vanished from B
  SYNC_MIN_EXPORT_RATIO: 0.5,                       // abort if the export has fewer than this share of linked contacts
  SYNC_REVIEW_SPREADSHEET_NAME: 'Contacts Sync Review'
};
