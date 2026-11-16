/**
 * "Refresh checked rows": re-count only the senders whose Refresh? box is ticked, straight from Gmail.
 * Meant for after you have cleaned a sender up by hand. Rows that reach 0 stay (greyed) so your notes are kept.
 */

function refreshChecked() {
  const ui = SpreadsheetApp.getUi();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) {
    ui.alert('Another run is writing the sheet. Try again in a minute.');
    return;
  }
  try {
    if (getJob_()) {
      ui.alert('A scan is still running. Wait for it to finish (see Scan status), or stop it first.');
      return;
    }
    const t0 = Date.now();
    const data = loadSenders_();
    const targets = data.list.filter(o => o.checked);
    if (!targets.length) {
      ui.alert('No rows are ticked in the Refresh? column.');
      return;
    }

    let done = 0, left = 0;
    const failed = [], approx = [], skipped = [];
    targets.forEach(o => {
      if (Date.now() - t0 > CONFIG.TIME_BUDGET_MS) { left++; return; }
      if (o.email.indexOf('@') < 0) { o.checked = false; skipped.push(o.email); return; }
      try {
        if (refreshOne_(o) === 'approx') approx.push(o.email);
        o.checked = false;
        done++;
      } catch (e) {
        failed.push(o.email + ' (' + ((e && e.message) || e) + ')');
      }
    });
    saveSenders_(data.list);

    let msg = 'Refreshed ' + done + ' sender(s).';
    if (left) msg += '\n' + left + ' still ticked; run Refresh again to continue.';
    if (failed.length) msg += '\nFailed, left ticked:\n' + failed.join('\n');
    if (approx.length) msg += '\nSize is an estimate (too many messages to re-measure) for:\n' + approx.join('\n');
    if (skipped.length) msg += '\nNothing to look up for: ' + skipped.join(', ');
    ui.alert(msg);
  } finally {
    lock.releaseLock();
  }
}

/** Returns 'exact' or 'approx'. Only touches o once the new numbers are fully computed. */
function refreshOne_(o) {
  const q = 'from:"' + o.email + '"';
  const ids = listAll_(q);

  if (!ids.length) {
    resetStats_(o);
    return 'exact';
  }

  if (ids.length <= CONFIG.REFRESH_EXACT_MAX) {
    const fresh = newSender_(o.email, o.name);
    fetchMetadata_(ids).forEach(m => {
      const headers = (m.payload && m.payload.headers) || [];
      let from = '', unsub = false;
      headers.forEach(h => {
        const n = String(h.name).toLowerCase();
        if (n === 'from' && !from) from = h.value;
        else if (n === 'list-unsubscribe') unsub = true;
      });
      const p = parseFrom_(from);
      if (p.email !== o.email) return; // from:"x" also matches display names; keep only this exact address
      applyMessage_(fresh, m, unsub, p.name);
    });
    copyStats_(o, fresh);
    return 'exact';
  }

  // Large sender: counts from list queries only; size scaled from the previous measurement.
  const all = ids.length;
  const inbox = listAll_(q + ' in:inbox').length;
  const years = {};
  const firstYear = o.first ? new Date(o.first).getFullYear() : CONFIG.FIRST_YEAR;
  for (let y = Math.max(CONFIG.FIRST_YEAR, firstYear); y <= new Date().getFullYear(); y++) {
    const n = listAll_(q + ' after:' + y + '/1/1 before:' + (y + 1) + '/1/1').length;
    if (n) years[y] = n;
  }
  const ends = fetchMetadata_([ids[0], ids[ids.length - 1]]).map(m => Number(m.internalDate) || 0).filter(Boolean);
  const sizeMb = o.all > 0 ? o.sizeMb * (all / o.all) : o.sizeMb;

  o.all = all;
  o.inbox = inbox;
  o.sizeMb = sizeMb;
  o.years = years;
  if (ends.length) { o.first = Math.min.apply(null, ends); o.last = Math.max.apply(null, ends); }
  return 'approx';
}
