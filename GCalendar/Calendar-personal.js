// Personal calendar tweaker (Google Apps Script).
// Replaces shorthand in event titles (":lunch:" -> "🍔") for events I own.
//
// Setup: paste into script.google.com, run installTrigger() once and authorize.
// Test safely: set SETTINGS.dryRun = true and run calendarEventTweaker(); check the log.

const SETTINGS = {
  calendarId: 'primary',
  daysBack: 1,
  daysAhead: 15,
  dryRun: false,
};

// Shorthand -> replacement. Matched case-insensitively, longest key first.
// Every replacement must be safe to re-apply (idempotent), since the trigger
// re-runs on every calendar update.
const EMOJI = {
  ':f:': '🧑‍💻',
  '#f': '🧑‍💻',
  ':focus:': '🧑‍💻',
  ':coffee:': '☕',
  ':lunch:': '🍔',
  ':child:': '🧒🏻',
  ':family:': '👦🏻👩🏻👦🏻',
  ':ayaansh:': '🧒🏻 Ayaansh',
  ':dr:': '🏥',
};

const EMOJI_REGEX = buildEmojiRegex_(EMOJI);

function calendarEventTweaker() {
  const calendar = CalendarApp.getCalendarById(SETTINGS.calendarId) ||
                   CalendarApp.getDefaultCalendar();
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const start = new Date(now - SETTINGS.daysBack * dayMs);
  const end = new Date(now + SETTINGS.daysAhead * dayMs);

  const events = calendar.getEvents(start, end);
  Logger.log(`${events.length} events between ${start} and ${end}` +
             (SETTINGS.dryRun ? ' [dry run]' : ''));

  let changed = 0;
  for (const event of events) {
    if (!event.isOwnedByMe()) continue;
    try {
      if (updateTitle_(event)) changed++;
    } catch (err) {
      Logger.log(`Failed on "${event.getTitle()}": ${err}`);
    }
  }
  Logger.log(`Updated ${changed} titles.`);
}

// Returns true if the title was (or, in dry run, would be) changed.
function updateTitle_(event) {
  const title = event.getTitle();
  const newTitle = title
    .replace(EMOJI_REGEX, (match) => EMOJI[match.toLowerCase()])
    .replace(/\s+/g, ' ')
    .trim();
  if (newTitle === title) return false;

  Logger.log(`${event.getStartTime()}: "${title}" -> "${newTitle}"`);
  if (!SETTINGS.dryRun) event.setTitle(newTitle);
  return true;
}

function buildEmojiRegex_(map) {
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = Object.keys(map)
    .sort((a, b) => b.length - a.length)
    // "#f" shouldn't fire inside "#foo"
    .map((k) => escape(k) + (/\w$/.test(k) ? '(?!\\w)' : ''))
    .join('|');
  return new RegExp(pattern, 'gi');
}

// Run once: re-tweaks titles whenever the calendar changes. Safe to re-run.
function installTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'calendarEventTweaker')
    .forEach((t) => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('calendarEventTweaker')
    .forUserCalendar(Session.getEffectiveUser().getEmail())
    .onEventUpdated()
    .create();
}
