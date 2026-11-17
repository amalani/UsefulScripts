/**
 * The Senders sheet is the database. Columns A..K are fixed, then one column per year (FIRST_YEAR .. this year).
 * Rows are keyed by sender address, so you can sort, filter or hide columns freely between runs.
 */

const COL = { CHECK: 1, EMAIL: 2, NAME: 3, DOMAIN: 4, INBOX: 5, ALL: 6, SIZE: 7, FIRST: 8, LAST: 9, NEWS: 10, ACTION: 11 };
const FIXED_COLS = 11;
const HEADERS = ['Refresh?', 'Sender', 'Name', 'Domain', 'In inbox', 'All mail', 'Size (MB)', 'First', 'Last', 'Newsletter', 'Action'];

function yearRange_() {
  const out = [];
  for (let y = CONFIG.FIRST_YEAR; y <= new Date().getFullYear(); y++) out.push(y);
  return out;
}

function ensureSize_(sh, rows, cols) {
  if (sh.getMaxRows() < rows) sh.insertRowsAfter(sh.getMaxRows(), rows - sh.getMaxRows());
  if (sh.getMaxColumns() < cols) sh.insertColumnsAfter(sh.getMaxColumns(), cols - sh.getMaxColumns());
}

function getSendersSheet_() {
  return SpreadsheetApp.getActive().getSheetByName(CONFIG.SENDERS_SHEET) || setupSheets_();
}

/** Creates (or repairs) the Senders, Domains and Status tabs. Safe to run repeatedly. */
function setupSheets_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(CONFIG.SENDERS_SHEET);
  if (!sh) {
    const all = ss.getSheets();
    if (all.length === 1 && all[0].getLastRow() === 0 && /^Sheet\d*$/.test(all[0].getName())) {
      sh = all[0];
      sh.setName(CONFIG.SENDERS_SHEET);
    } else {
      sh = ss.insertSheet(CONFIG.SENDERS_SHEET, 0);
    }
  }
  const years = yearRange_();
  const cols = FIXED_COLS + years.length;
  ensureSize_(sh, 2, cols);
  sh.getRange(1, 1, 1, cols).setValues([HEADERS.concat(years)]).setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.setFrozenColumns(COL.EMAIL);
  if (!sh.getFilter()) sh.getRange(1, 1, sh.getMaxRows(), cols).createFilter();

  // Grey out senders that are fully cleaned up (rows stay, so you keep your Action notes).
  const rule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($B2<>"",$F2=0)')
    .setFontColor('#9aa0a6')
    .setRanges([sh.getRange(2, 1, sh.getMaxRows() - 1, cols)])
    .build();
  sh.setConditionalFormatRules([rule]);

  let dom = ss.getSheetByName(CONFIG.DOMAINS_SHEET);
  if (!dom) dom = ss.insertSheet(CONFIG.DOMAINS_SHEET);
  const s = CONFIG.SENDERS_SHEET;
  dom.getRange('A1').setFormula(
    '=QUERY(' + s + '!A2:K, "select D, count(B), sum(E), sum(F), sum(G), min(H), max(I) ' +
    'where D is not null group by D order by sum(F) desc ' +
    "label D 'Domain', count(B) 'Senders', sum(E) 'In inbox', sum(F) 'All mail', sum(G) 'Size (MB)', min(H) 'First', max(I) 'Last'\", 0)");
  dom.setFrozenRows(1);
  dom.getRange('A1:G1').setFontWeight('bold');
  dom.getRange('B2:D').setNumberFormat('#,##0');
  dom.getRange('E2:E').setNumberFormat('0.00');
  dom.getRange('F2:G').setNumberFormat('yyyy-mm-dd');

  if (!ss.getSheetByName(CONFIG.STATUS_SHEET)) ss.insertSheet(CONFIG.STATUS_SHEET);
  return sh;
}

function toMs_(v) {
  return v instanceof Date ? v.getTime() : 0;
}

function newSender_(email, name) {
  return {
    checked: false, email: email, name: name || '', domain: rootDomain_(email),
    inbox: 0, all: 0, sizeMb: 0, first: 0, last: 0, news: false, action: '', years: {}
  };
}

function resetStats_(o) {
  o.inbox = 0; o.all = 0; o.sizeMb = 0; o.first = 0; o.last = 0; o.news = false; o.years = {};
}

function copyStats_(to, from) {
  to.inbox = from.inbox; to.all = from.all; to.sizeMb = from.sizeMb;
  to.first = from.first; to.last = from.last; to.news = from.news; to.years = from.years;
  if (from.name) to.name = from.name;
}

/** Reads the whole table into { list: [sender objects in sheet order], map: { email: sender } }. */
function loadSenders_() {
  const sh = getSendersSheet_();
  const list = [], map = {};
  const lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow < 2) return { list: list, map: map };

  const header = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  const yearCols = [];
  for (let c = FIXED_COLS; c < header.length; c++) {
    const y = Number(header[c]);
    if (y >= 1990 && y <= 2100) yearCols.push({ idx: c, year: y });
  }
  sh.getRange(2, 1, lastRow - 1, lastCol).getValues().forEach(r => {
    const email = String(r[COL.EMAIL - 1] || '').trim();
    if (!email) return;
    const o = {
      checked: r[COL.CHECK - 1] === true,
      email: email,
      name: String(r[COL.NAME - 1] || ''),
      domain: String(r[COL.DOMAIN - 1] || ''),
      inbox: Number(r[COL.INBOX - 1]) || 0,
      all: Number(r[COL.ALL - 1]) || 0,
      sizeMb: Number(r[COL.SIZE - 1]) || 0,
      first: toMs_(r[COL.FIRST - 1]),
      last: toMs_(r[COL.LAST - 1]),
      news: r[COL.NEWS - 1] === 'Y',
      action: String(r[COL.ACTION - 1] || ''),
      years: {}
    };
    yearCols.forEach(yc => {
      const n = Number(r[yc.idx]) || 0;
      if (n) o.years[yc.year] = n;
    });
    list.push(o);
    map[email] = o;
  });
  return { list: list, map: map };
}

/** Rewrites the whole table (header + one row per sender). */
function saveSenders_(list) {
  const sh = getSendersSheet_();
  const years = yearRange_();
  const cols = FIXED_COLS + years.length;
  const n = list.length;
  ensureSize_(sh, n + 1, cols);

  sh.getRange(1, 1, 1, cols).setValues([HEADERS.concat(years)]).setFontWeight('bold');
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getMaxColumns()).clearContent();
  if (!n) return;

  const rows = list.map(o => {
    const r = [
      o.checked, o.email, o.name, o.domain, o.inbox, o.all, Math.round(o.sizeMb * 1000) / 1000,
      o.first ? new Date(o.first) : '', o.last ? new Date(o.last) : '', o.news ? 'Y' : '', o.action
    ];
    years.forEach(y => r.push(o.years[y] || ''));
    return r;
  });
  sh.getRange(2, 1, n, cols).setValues(rows);

  sh.getRange(2, COL.CHECK, n, 1).insertCheckboxes();
  sh.getRange(2, COL.INBOX, n, 2).setNumberFormat('#,##0');
  sh.getRange(2, COL.SIZE, n, 1).setNumberFormat('0.00');
  sh.getRange(2, COL.FIRST, n, 2).setNumberFormat('yyyy-mm-dd');
  sh.getRange(2, COL.ACTION, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(CONFIG.ACTIONS, true).setAllowInvalid(true).build());
}

function writeStatus_(kv) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(CONFIG.STATUS_SHEET) || ss.insertSheet(CONFIG.STATUS_SHEET);
  const rows = Object.keys(kv).map(k => [k, kv[k]]);
  sh.clear();
  sh.getRange(1, 1, rows.length, 2).setValues(rows);
  sh.getRange(1, 1, rows.length, 1).setFontWeight('bold');
  sh.setColumnWidth(1, 200);
  sh.setColumnWidth(2, 420);
  stampStatus_(kv['Mode'] ? 'scan chunk (' + kv['Mode'] + ')' : 'scan chunk');
}

/** Status!C1 = when anything last ran (a scan chunk or a refresh), C2 = what ran. */
function stampStatus_(what) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(CONFIG.STATUS_SHEET) || ss.insertSheet(CONFIG.STATUS_SHEET);
  sh.getRange('C1').setValue(new Date()).setNumberFormat('yyyy-mm-dd hh:mm:ss').setFontWeight('bold');
  sh.getRange('C2').setValue(what);
  sh.setColumnWidth(3, 170);
}
