/**
 * Snapshot every contact (plus label names) to a JSON file in Drive.
 * Run this by hand before anything destructive; dedupeApply() also calls it.
 */
function backupContacts() {
  const contacts = fetchAllContacts_();
  const snapshot = {
    account: Session.getActiveUser().getEmail(),
    takenAt: new Date().toISOString(),
    count: contacts.length,
    groups: fetchGroupNames_(),
    contacts: contacts
  };

  const folder = getOrCreateFolder_(CONFIG.BACKUP_FOLDER);
  const stamp = Utilities.formatDate(new Date(), 'UTC', "yyyy-MM-dd'T'HHmmss'Z'");
  const file = folder.createFile('contacts-' + stamp + '.json', JSON.stringify(snapshot), MimeType.PLAIN_TEXT);
  pruneBackups_(folder);

  Logger.log('Backed up %s contacts to %s', contacts.length, file.getUrl());
  return file.getUrl();
}

function getOrCreateFolder_(name) {
  const it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

function pruneBackups_(folder) {
  const files = [];
  const it = folder.getFiles();
  while (it.hasNext()) {
    const f = it.next();
    if (/^contacts-.*\.json$/.test(f.getName())) files.push(f);
  }
  files.sort(function (a, b) { return b.getName() < a.getName() ? -1 : 1; }); // newest first
  files.slice(CONFIG.BACKUP_KEEP).forEach(function (f) { f.setTrashed(true); });
}
