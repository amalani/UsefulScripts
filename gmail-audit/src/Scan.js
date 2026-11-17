/**
 * Scan engine. One "job" at a time, kept in Script Properties and worked in ~5 minute chunks:
 *
 *   initial      every message, newest first. Resumes itself via a one-minute trigger until it is done.
 *   incremental  only mail newer than the saved cursor (the newest message the last job counted).
 *
 * A chunk reads the Senders sheet, adds the messages it fetched to the per-sender totals, writes the sheet, and only
 * then saves the job position, so a run killed mid-way is simply repeated instead of double counted.
 */

const PROP = PropertiesService.getScriptProperties();
const TAIL_KEEP = 100; // ids of the previous page remembered, to skip repeats if new mail shifted the paging

function getJob_() { return JSON.parse(PROP.getProperty('JOB') || 'null'); }
function setJob_(j) { PROP.setProperty('JOB', JSON.stringify(j)); }
function clearJob_() { PROP.deleteProperty('JOB'); }

function clearTriggers_(handler) {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === handler) ScriptApp.deleteTrigger(t);
  });
}

function scheduleContinue_() {
  clearTriggers_('scanTick');
  ScriptApp.newTrigger('scanTick').timeBased().after(CONFIG.CONTINUE_DELAY_MIN * 60 * 1000).create();
}

function newJob_(mode, q, minMs) {
  return { mode: mode, q: q, minMs: minMs, token: null, tail: [], sawFirstPage: false, topMs: 0,
           processed: 0, counted: 0, fails: 0, started: Date.now() };
}

function beginInitial_() {
  PROP.deleteProperty('CURSOR_MS');
  setJob_(newJob_('initial', '', 0));
  scheduleContinue_();
}

/** Trigger / menu entry point: do one chunk of the current job, then re-schedule if it isn't finished. */
function scanTick() {
  clearTriggers_('scanTick');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    scheduleContinue_(); // something else is writing the sheet; try again shortly
    return;
  }
  try {
    runJobChunk_();
  } finally {
    lock.releaseLock();
  }
}

function addMessage_(data, m) {
  const headers = (m.payload && m.payload.headers) || [];
  let from = '', unsub = false;
  headers.forEach(h => {
    const n = String(h.name).toLowerCase();
    if (n === 'from' && !from) from = h.value;
    else if (n === 'list-unsubscribe') unsub = true;
  });
  const p = parseFrom_(from);
  const email = p.email || '(no sender)';
  let o = data.map[email];
  if (!o) {
    o = newSender_(email, p.name);
    data.map[email] = o;
    data.list.push(o);
  }
  applyMessage_(o, m, unsub, p.name);
}

function applyMessage_(o, m, unsub, name) {
  const ms = Number(m.internalDate) || 0;
  o.all++;
  if ((m.labelIds || []).indexOf('INBOX') >= 0) o.inbox++;
  o.sizeMb += (Number(m.sizeEstimate) || 0) / 1048576;
  if (unsub) o.news = true;
  if (ms) {
    if (!o.first || ms < o.first) o.first = ms;
    if (ms >= o.last) { o.last = ms; if (name) o.name = name; } // keep the newest display name
    const y = Math.min(new Date().getFullYear(), Math.max(CONFIG.FIRST_YEAR, new Date(ms).getFullYear()));
    o.years[y] = (o.years[y] || 0) + 1;
  }
}

function runJobChunk_() {
  const job = getJob_();
  if (!job) return;
  const t0 = Date.now();
  HARD_DEADLINE = t0 + 5.3 * 60 * 1000;
  const data = loadSenders_();
  let done = false, errMsg = '';

  try {
    while (Date.now() - t0 < CONFIG.TIME_BUDGET_MS) {
      const page = listIds_(job.q, job.token);
      const tail = {};
      (job.tail || []).forEach(id => { tail[id] = true; });
      const fresh = page.ids.filter(id => !tail[id]);
      const msgs = fresh.length ? fetchMetadata_(fresh) : [];

      if (!job.sawFirstPage) {
        msgs.forEach(m => { const ms = Number(m.internalDate) || 0; if (ms > job.topMs) job.topMs = ms; });
        job.sawFirstPage = true;
      }
      msgs.forEach(m => {
        if (job.minMs && (Number(m.internalDate) || 0) <= job.minMs) return;
        addMessage_(data, m);
        job.counted++;
      });
      job.processed += page.ids.length;
      job.tail = page.ids.slice(-TAIL_KEEP);
      job.token = page.nextToken;
      if (!job.token) { done = true; break; }
    }
    job.fails = 0;
  } catch (e) {
    errMsg = String((e && e.message) || e);
    // Being throttled is not a failure: progress up to the last finished page is saved and the next chunk retries.
    if (!isQuotaError_(e)) job.fails = (job.fails || 0) + 1;
  }

  if (done && job.mode === 'initial') data.list.sort((a, b) => b.all - a.all);
  saveSenders_(data.list);

  let state;
  if (done) {
    const old = Number(PROP.getProperty('CURSOR_MS')) || 0;
    if (job.topMs > old) PROP.setProperty('CURSOR_MS', String(job.topMs));
    clearJob_();
    state = 'Complete';
  } else if (job.fails >= 5) {
    clearJob_();
    state = 'Stopped after repeated errors (run the scan again to resume from scratch if needed)';
  } else {
    setJob_(job);
    scheduleContinue_();
    state = 'Running; next chunk in about ' + CONFIG.CONTINUE_DELAY_MIN + ' minute(s)';
  }

  const cursor = Number(PROP.getProperty('CURSOR_MS')) || 0;
  writeStatus_({
    'State': state,
    'Mode': job.mode,
    'Messages listed so far': job.processed,
    'Messages counted': job.counted,
    'Senders in sheet': data.list.length,
    'Last chunk finished': new Date(),
    'Counted up to (newest mail)': cursor ? new Date(cursor) : '(not set yet)',
    'Last error': errMsg,
    'Fetch stats (this run)': 'batches ' + FETCH_STATS.batches + ', rate-limited parts ' + FETCH_STATS.rateLimitedParts +
      ', other failed parts ' + FETCH_STATS.otherFailedParts + ', single-get fallbacks ' + FETCH_STATS.singleGets
  });
}
