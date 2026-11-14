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

  REVIEW_SPREADSHEET_NAME: 'Contacts Dedupe Review'
};
