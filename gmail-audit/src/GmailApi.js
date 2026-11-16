/**
 * Thin Gmail helpers: list message ids, fetch header metadata fast (batched), parse the From header.
 * Only metadata is requested (From, List-Unsubscribe, date, size, labels). Bodies are never read.
 */

const META_HEADERS = ['From', 'List-Unsubscribe'];
const META_FIELDS = 'id,internalDate,sizeEstimate,labelIds,payload/headers';

function withRetry_(fn) {
  let lastErr;
  for (let i = 0; i < 5; i++) {
    try {
      return fn();
    } catch (e) {
      lastErr = e;
      Utilities.sleep(500 * Math.pow(2, i));
    }
  }
  throw lastErr;
}

/** One page of message ids (newest first). Spam and Trash are excluded by default. */
function listIds_(q, pageToken) {
  const params = { maxResults: CONFIG.LIST_PAGE, fields: 'messages/id,nextPageToken' };
  if (q) params.q = q;
  if (pageToken) params.pageToken = pageToken;
  const res = withRetry_(() => Gmail.Users.Messages.list('me', params));
  return { ids: (res.messages || []).map(m => m.id), nextToken: res.nextPageToken || null };
}

/** Every id matching q (all pages). */
function listAll_(q) {
  const out = [];
  let token = null;
  do {
    const page = listIds_(q, token);
    page.ids.forEach(id => out.push(id));
    token = page.nextToken;
  } while (token);
  return out;
}

/**
 * Metadata for many message ids. Uses Gmail's batch endpoint (up to BATCH_SIZE gets per HTTP call), retries the
 * parts that were rate limited, and falls back to single gets. Messages deleted since listing (404) are skipped.
 */
function fetchMetadata_(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += CONFIG.BATCH_SIZE) {
    let pending = ids.slice(i, i + CONFIG.BATCH_SIZE);
    for (let attempt = 0; attempt < 4 && pending.length; attempt++) {
      const res = batchGet_(pending);
      res.ok.forEach(m => out.push(m));
      pending = res.failed;
      if (pending.length) Utilities.sleep(1000 * Math.pow(2, attempt));
    }
    pending.forEach(id => {
      const m = singleGet_(id);
      if (m) out.push(m);
    });
    Utilities.sleep(CONFIG.BATCH_PAUSE_MS);
  }
  return out;
}

/** Single get via the Advanced Service. Returns null for a message that no longer exists; throws on other errors. */
function singleGet_(id) {
  try {
    return withRetry_(() => Gmail.Users.Messages.get('me', id, {
      format: 'metadata', metadataHeaders: META_HEADERS, fields: META_FIELDS
    }));
  } catch (e) {
    if (/not found|404/i.test(String(e && e.message))) return null;
    throw e;
  }
}

function batchGet_(ids) {
  const boundary = 'batch_' + Utilities.getUuid().replace(/-/g, '');
  const qs = 'format=metadata' +
    META_HEADERS.map(h => '&metadataHeaders=' + encodeURIComponent(h)).join('') +
    '&fields=' + encodeURIComponent(META_FIELDS);
  let body = '';
  ids.forEach(id => {
    body += '--' + boundary + '\r\n' +
      'Content-Type: application/http\r\n' +
      'Content-ID: <item-' + id + '>\r\n\r\n' +
      'GET /gmail/v1/users/me/messages/' + id + '?' + qs + '\r\n\r\n';
  });
  body += '--' + boundary + '--';

  let resp;
  try {
    resp = UrlFetchApp.fetch('https://www.googleapis.com/batch/gmail/v1', {
      method: 'post',
      contentType: 'multipart/mixed; boundary=' + boundary,
      payload: body,
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });
  } catch (e) {
    return { ok: [], failed: ids };
  }
  if (resp.getResponseCode() !== 200) return { ok: [], failed: ids };
  return parseBatch_(resp.getContentText(), ids);
}

/** Splits a multipart/mixed batch response into messages. Ids missing or non-200 (except 404) come back as failed. */
function parseBatch_(text, ids) {
  const firstLine = text.split(/\r?\n/).find(l => l.indexOf('--') === 0);
  if (!firstLine) return { ok: [], failed: ids };
  const boundary = firstLine.trim();
  const seen = {};
  const ok = [];
  text.split(boundary).forEach(part => {
    const idm = part.match(/Content-ID:\s*<response-item-([^>\s]+)>/i);
    if (!idm) return;
    const id = idm[1];
    const st = part.match(/HTTP\/\d(?:\.\d)?\s+(\d{3})/);
    const status = st ? Number(st[1]) : 0;
    if (status === 404) { seen[id] = true; return; }   // deleted since we listed it
    if (status !== 200) return;                          // rate limit / server error: retry
    const a = part.indexOf('{', st.index);
    const b = part.lastIndexOf('}');
    if (a < 0 || b < a) return;
    try {
      ok.push(JSON.parse(part.slice(a, b + 1)));
      seen[id] = true;
    } catch (e) { /* leave it unseen so it is retried */ }
  });
  return { ok: ok, failed: ids.filter(id => !seen[id]) };
}

/** '"Some Name" <A@B.com>' -> { email: 'a@b.com', name: 'Some Name' } */
function parseFrom_(raw) {
  raw = String(raw || '').trim();
  let email = raw, name = '';
  const m = raw.match(/^(.*?)<([^>]+)>/);
  if (m) {
    email = m[2].trim();
    name = m[1].trim().replace(/^"+|"+$/g, '').trim();
  }
  return { email: email.toLowerCase(), name: name };
}

const TWO_LEVEL_SLD_ = ['co', 'com', 'org', 'net', 'gov', 'edu', 'ac'];

/** news.shopify.com -> shopify.com ; mail.foo.co.uk -> foo.co.uk. Groups a company's many sending subdomains. */
function rootDomain_(email) {
  const at = email.lastIndexOf('@');
  if (at < 0) return '';
  const labels = email.slice(at + 1).split('.').filter(Boolean);
  if (labels.length <= 2) return labels.join('.');
  const tld = labels[labels.length - 1];
  const sld = labels[labels.length - 2];
  const twoLevel = tld.length === 2 && TWO_LEVEL_SLD_.indexOf(sld) >= 0;
  return labels.slice(-(twoLevel ? 3 : 2)).join('.');
}
