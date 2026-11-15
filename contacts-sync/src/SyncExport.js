/**
 * B side of the B -> A sync. Run in the account that holds the phone/shared book.
 *
 * exportForSync() writes the fields B "owns" (names, phones, addresses, orgs, birthdays, emails)
 * to ONE Drive file that is overwritten each time, so its sharing settings survive.
 * After the first run, share that file with account A (Viewer) in the Drive UI. Notes, labels and
 * photos are deliberately not exported.
 */
function exportForSync() {
  const slim = fetchAllContacts_().map(slimForSync_).filter(Boolean);
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), count: slim.length, contacts: slim });

  const folder = getOrCreateFolder_(CONFIG.SYNC_FOLDER);
  const it = folder.getFilesByName(CONFIG.SYNC_EXPORT_NAME);
  let file;
  if (it.hasNext()) {
    file = it.next();
    file.setContent(payload);
    Logger.log('Updated export (%s contacts): %s', slim.length, file.getUrl());
  } else {
    file = folder.createFile(CONFIG.SYNC_EXPORT_NAME, payload, MimeType.PLAIN_TEXT);
    Logger.log('First export (%s contacts). Share this file with account A as Viewer: %s', slim.length, file.getUrl());
  }
}

function slimForSync_(p) {
  const out = { id: p.resourceName };
  const n = (p.names || [])[0];
  if (n) out.names = [clean_(n)];
  ['emailAddresses', 'phoneNumbers', 'addresses', 'organizations', 'birthdays'].forEach(function (f) {
    if ((p[f] || []).length) out[f] = p[f].map(clean_);
  });
  // nothing worth syncing
  if (!out.names && !out.emailAddresses && !out.phoneNumbers) return null;
  return out;
}

function installWeeklyExportTrigger() {
  installWeekly_('exportForSync', 5);
}

function installWeekly_(handler, hour) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === handler) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger(handler).timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(hour).create();
  Logger.log('Weekly trigger installed for %s (Mondays ~%s:00).', handler, hour);
}
