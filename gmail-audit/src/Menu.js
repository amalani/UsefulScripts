/** Custom menu and the functions it calls. Everything here runs from the sheet's "Gmail Audit" menu. */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Gmail Audit')
    .addItem('1. Set up sheets', 'setupSheetsMenu')
    .addItem('2. Start initial scan', 'startInitialScan')
    .addSeparator()
    .addItem('Refresh checked rows', 'refreshChecked')
    .addItem('Add new mail since last run', 'addNewMail')
    .addSeparator()
    .addItem('Scan status', 'scanStatus')
    .addItem('Stop scan', 'stopScan')
    .addItem('Full rebuild...', 'fullRebuild')
    .addToUi();
}

function setupSheetsMenu() {
  setupSheets_();
  SpreadsheetApp.getActive().toast('Sheets are set up.', 'Gmail Audit', 5);
}

function hasCounts_() {
  return loadSenders_().list.some(o => o.all > 0);
}

function startInitialScan() {
  const ui = SpreadsheetApp.getUi();
  if (getJob_()) { ui.alert('A scan is already running. See Scan status.'); return; }
  setupSheets_();
  if (hasCounts_()) {
    ui.alert('The Senders sheet already has counts. Use "Add new mail since last run", or "Full rebuild..." to start over.');
    return;
  }
  beginInitial_();
  ui.alert('Scan started. It works in the background in ~5 minute chunks and re-triggers itself every minute until ' +
    'every message is counted. You can close this sheet. Check the Status tab for progress.\n\n' +
    'Tip: avoid deleting or archiving mail until it finishes, or the counts for that stretch can drift (a refresh fixes them).');
}

function addNewMail() {
  const ui = SpreadsheetApp.getUi();
  if (getJob_()) { ui.alert('A scan is already running. See Scan status.'); return; }
  const cursor = Number(PROP.getProperty('CURSOR_MS')) || 0;
  if (!cursor) { ui.alert('Run the initial scan first and let it finish.'); return; }
  setupSheets_();
  setJob_(newJob_('incremental', 'after:' + Math.max(0, Math.floor(cursor / 1000) - 1), cursor));
  scanTick();
  ui.alert(getJob_()
    ? 'More new mail than fits in one run. It continues in the background; check the Status tab.'
    : 'Done. New mail has been added to the counts.');
}

function scanStatus() {
  const ui = SpreadsheetApp.getUi();
  const job = getJob_();
  const cursor = Number(PROP.getProperty('CURSOR_MS')) || 0;
  ui.alert(job
    ? 'Running (' + job.mode + '): ' + job.processed + ' messages listed, ' + job.counted + ' counted.'
    : 'No scan running. ' + (cursor ? 'Counted up to ' + new Date(cursor) + '.' : 'No scan has completed yet.'));
}

function stopScan() {
  clearTriggers_('scanTick');
  clearJob_();
  SpreadsheetApp.getUi().alert('Scan stopped. Counts so far are in the sheet. Start a new scan to continue; ' +
    'use "Full rebuild..." if you want the totals to be consistent.');
}

/** Zeroes every count (rows and your Action notes stay) and scans the whole mailbox again. */
function fullRebuild() {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('Recount everything from scratch? Rows and Action notes are kept; counts are reset to 0 and rebuilt.',
      ui.ButtonSet.OK_CANCEL) !== ui.Button.OK) return;
  clearTriggers_('scanTick');
  clearJob_();
  setupSheets_();
  const data = loadSenders_();
  data.list.forEach(o => { resetStats_(o); o.checked = false; });
  saveSenders_(data.list);
  beginInitial_();
  ui.alert('Rebuild started. See the Status tab for progress.');
}
