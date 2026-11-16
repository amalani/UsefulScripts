/**
 * Settings for the Gmail audit tool. The script is bound to a Google Sheet and only ever READS Gmail
 * (gmail.readonly): it never deletes, archives or labels anything.
 */
const CONFIG = {
  SENDERS_SHEET: 'Senders',   // one row per sender address; you work in this tab
  DOMAINS_SHEET: 'Domains',   // formula-driven roll-up of Senders by domain
  STATUS_SHEET: 'Status',     // progress of the current / last scan

  FIRST_YEAR: 2004,           // first per-year column (Gmail launched in 2004)

  LIST_PAGE: 500,             // message ids per messages.list call (API max)
  BATCH_SIZE: 40,             // messages per Gmail batch request (each get costs 5 quota units; limit ~250/sec)
  BATCH_PAUSE_MS: 700,        // pause between batches, keeps us under the per-user rate limit
  TIME_BUDGET_MS: 4.5 * 60 * 1000, // stop starting new pages after this; Apps Script kills runs at 6 min
  CONTINUE_DELAY_MIN: 1,      // a scan that isn't finished re-triggers itself this many minutes later

  REFRESH_EXACT_MAX: 1500,    // "Refresh checked rows": re-measure every message up to this many per sender;
                              // above it, counts are exact but size is scaled from the old value (an estimate)

  ACTIONS: ['Keep', 'Unsubscribe', 'Delete'] // dropdown in the Action column (for your own notes)
};
