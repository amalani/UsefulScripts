/**
 * Duplicate contacts: find, review, merge. Runs in whichever account it is deployed to.
 *
 *   dedupeDryRun()  - changes nothing; writes the proposed merges to a review Sheet.
 *   dedupeApply()   - backs up, then merges only the HIGH-confidence groups.
 *
 * HIGH   : contacts share an email or phone AND their names are compatible
 *          (or one has no name). Auto-merged by dedupeApply().
 * REVIEW : same name but nothing else in common, or a shared email/phone with
 *          clearly different names (e.g. a family landline). Never auto-merged;
 *          merge those by hand in Google Contacts.
 */

function dedupeDryRun() {
  const contacts = fetchAllContacts_();
  const plan = buildPlan_(contacts);
  writeReviewSheet_(plan);
  Logger.log('%s contacts: %s auto-merge groups, %s review groups. See the review Sheet.',
    contacts.length, plan.high.length, plan.review.length);
}

function dedupeApply() {
  const started = Date.now();
  backupContacts();

  const plan = buildPlan_(fetchAllContacts_());
  let merged = 0, deleted = 0, failed = 0;

  for (let i = 0; i < plan.high.length; i++) {
    if (merged >= CONFIG.MAX_MERGES_PER_RUN) { Logger.log('Hit MAX_MERGES_PER_RUN; run again for the rest.'); break; }
    if (Date.now() - started > CONFIG.TIME_BUDGET_MS) { Logger.log('Out of time; run again for the rest.'); break; }

    const group = plan.high[i];
    const survivor = pickSurvivor_(group);
    const losers = group.filter(function (p) { return p !== survivor; });
    try {
      const resource = buildMerged_(survivor, losers);
      People.People.updateContact(resource, survivor.resourceName, { updatePersonFields: MERGE_FIELDS });
      Utilities.sleep(CONFIG.PAUSE_MS);
      losers.forEach(function (l) {
        People.People.deleteContact(l.resourceName);
        deleted++;
        Utilities.sleep(CONFIG.PAUSE_MS);
      });
      merged++;
    } catch (e) {
      failed++;
      Logger.log('FAILED group of %s: %s', oneLine_(survivor), e);
    }
  }
  Logger.log('Merged %s groups, deleted %s duplicate contacts, %s failures.', merged, deleted, failed);
}

// ---------- planning ----------

function buildPlan_(contacts) {
  const n = contacts.length;
  const parent = contacts.map(function (_, i) { return i; });
  const find = function (x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = function (a, b) { parent[find(a)] = find(b); };

  // bucket contacts by shared email / phone
  const buckets = {};
  contacts.forEach(function (p, i) {
    emailKeys_(p).map(function (k) { return 'e:' + k; })
      .concat(phoneKeys_(p).map(function (k) { return 'p:' + k; }))
      .forEach(function (k) {
        (buckets[k] = buckets[k] || []);
        if (buckets[k].indexOf(i) === -1) buckets[k].push(i);
      });
  });

  const review = [];
  Object.keys(buckets).forEach(function (key) {
    const idx = buckets[key];
    if (idx.length < 2) return;
    if (idx.length > 8) { // company main line, shared inbox, etc.
      review.push({ reason: 'Shared key ' + key + ' on ' + idx.length + ' contacts (too many to auto-merge)', members: idx.map(function (i) { return contacts[i]; }) });
      return;
    }
    for (let a = 0; a < idx.length; a++) {
      for (let b = a + 1; b < idx.length; b++) {
        if (namesCompatible_(contacts[idx[a]], contacts[idx[b]])) union(idx[a], idx[b]);
        else review.push({ reason: 'Shared ' + key + ' but different names', members: [contacts[idx[a]], contacts[idx[b]]] });
      }
    }
  });

  const byRoot = {};
  for (let i = 0; i < n; i++) (byRoot[find(i)] = byRoot[find(i)] || []).push(contacts[i]);

  const high = [];
  Object.keys(byRoot).forEach(function (r) {
    const g = byRoot[r];
    if (g.length < 2) return;
    // transitive chains can join incompatible names; demote those to review
    let ok = true;
    for (let a = 0; a < g.length && ok; a++)
      for (let b = a + 1; b < g.length && ok; b++)
        if (!namesCompatible_(g[a], g[b])) ok = false;
    if (ok) high.push(g);
    else review.push({ reason: 'Linked by shared email/phone but names conflict', members: g });
  });

  // same full name, but not already linked: review only
  const byName = {};
  for (let i = 0; i < n; i++) {
    const nm = normName_(contacts[i]);
    if (nm.indexOf(' ') === -1) continue; // single-token names are too ambiguous
    (byName[nm] = byName[nm] || []).push(i);
  }
  Object.keys(byName).forEach(function (nm) {
    const idx = byName[nm];
    const roots = {};
    idx.forEach(function (i) { roots[find(i)] = 1; });
    if (idx.length > 1 && Object.keys(roots).length > 1) {
      review.push({ reason: 'Same name "' + nm + '", nothing else in common', members: idx.map(function (i) { return contacts[i]; }) });
    }
  });

  return { high: high, review: review };
}

function contactScore_(p) {
  return ['names', 'emailAddresses', 'phoneNumbers', 'addresses', 'organizations', 'birthdays', 'biographies', 'urls', 'userDefined', 'events']
    .reduce(function (s, f) { return s + (p[f] || []).length; }, 0);
}

function pickSurvivor_(group) {
  return group.slice().sort(function (a, b) { return contactScore_(b) - contactScore_(a); })[0];
}

// ---------- merging ----------

const MERGE_FIELDS = 'emailAddresses,phoneNumbers,addresses,organizations,urls,memberships,userDefined,birthdays,events,biographies';

/** Copy of a field value without read-only / metadata properties. */
function clean_(v) {
  const c = JSON.parse(JSON.stringify(v));
  delete c.metadata; delete c.formattedType; delete c.canonicalForm;
  return c;
}

/** Survivor's own data first, then anything the losers add (de-duplicated). */
function buildMerged_(survivor, losers) {
  const all = [survivor].concat(losers);
  const uniq = function (field, keyFn) {
    const seen = {}, out = [];
    all.forEach(function (p) {
      (p[field] || []).forEach(function (v) {
        const k = keyFn(v);
        if (!k || seen[k]) return;
        seen[k] = 1;
        out.push(clean_(v));
      });
    });
    return out;
  };
  const low = function (s) { return (s || '').trim().toLowerCase().replace(/\s+/g, ' '); };

  const res = { resourceName: survivor.resourceName, etag: survivor.etag };
  res.emailAddresses = uniq('emailAddresses', function (v) { return low(v.value); });
  res.phoneNumbers = uniq('phoneNumbers', function (v) {
    const d = (v.value || '').replace(/\D/g, '');
    return d ? d.slice(-CONFIG.PHONE_MATCH_DIGITS) : low(v.value);
  });
  res.addresses = uniq('addresses', function (v) {
    return low(v.formattedValue || [v.streetAddress, v.city, v.region, v.postalCode, v.country].join(' '));
  });
  res.organizations = uniq('organizations', function (v) { return low(v.name) + '|' + low(v.title); });
  res.urls = uniq('urls', function (v) { return low(v.value); });
  res.memberships = uniq('memberships', function (v) {
    return v.contactGroupMembership && v.contactGroupMembership.contactGroupResourceName;
  });
  res.userDefined = uniq('userDefined', function (v) { return low(v.key) + '=' + low(v.value); });
  res.events = uniq('events', function (v) { return JSON.stringify(v.date || {}) + '|' + low(v.type); });

  const bday = uniq('birthdays', function (v) { return JSON.stringify(v.date || {}); });
  res.birthdays = bday.slice(0, 1); // a contact holds one birthday

  const notes = [];
  all.forEach(function (p) {
    (p.biographies || []).forEach(function (b) {
      const t = (b.value || '').trim();
      if (t && notes.indexOf(t) === -1) notes.push(t);
    });
  });
  res.biographies = notes.length ? [{ value: notes.join('\n---\n'), contentType: 'TEXT_PLAIN' }] : [];
  return res;
}

// ---------- review sheet ----------

function writeReviewSheet_(plan) {
  const props = PropertiesService.getScriptProperties();
  let ss;
  const id = props.getProperty('REVIEW_SS_ID');
  try { ss = id ? SpreadsheetApp.openById(id) : null; } catch (e) { ss = null; }
  if (!ss) {
    ss = SpreadsheetApp.create(CONFIG.REVIEW_SPREADSHEET_NAME);
    props.setProperty('REVIEW_SS_ID', ss.getId());
  }
  const sheet = ss.getSheetByName('Review') || ss.insertSheet('Review');
  sheet.clear();

  const rows = [['Tier', 'Group', 'Action', 'Name', 'Emails', 'Phones', 'Reason', 'resourceName']];
  const describe = function (tier, g, action, p, reason) {
    rows.push([tier, g, action, displayName_(p), emailKeys_(p).join(', '),
      (p.phoneNumbers || []).map(function (x) { return x.value; }).join(', '), reason, p.resourceName]);
  };

  plan.high.forEach(function (group, i) {
    const survivor = pickSurvivor_(group);
    describe('HIGH', i + 1, 'KEEP', survivor, 'Shared email/phone, compatible names');
    group.forEach(function (p) { if (p !== survivor) describe('HIGH', i + 1, 'MERGE+DELETE', p, ''); });
  });
  plan.review.forEach(function (r, i) {
    r.members.forEach(function (p) { describe('REVIEW', 'R' + (i + 1), 'MANUAL', p, r.reason); });
  });

  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.setFrozenRows(1);
  Logger.log('Review sheet: %s', ss.getUrl());
}
