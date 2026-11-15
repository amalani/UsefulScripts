/**
 * A side of the B -> A sync. Run in the primary account, after B's exportForSync() has run
 * and its export file has been shared with this account.
 *
 *   syncDryRun()  - changes nothing; writes the plan to the "Contacts Sync Review" Sheet.
 *   syncApply()   - backs up, then applies the plan. Idempotent; safe to re-run.
 *
 * Linking: each A contact that mirrors a B contact carries an externalIds entry
 * {type: B_SYNC, value: <B resourceName>}. A contacts without one are never touched, except
 * that an unlinked A contact sharing an email/phone (and a compatible name) with a B contact
 * is linked to it. Per run, for every B contact:
 *   linked        -> B wins for name, phones, addresses, orgs, birthday; emails are unioned.
 *                    Notes, labels and everything else in A are left alone.
 *   no A match    -> created in A (SYNC_CREATE_NEW).
 *   ambiguous     -> listed for review, never written.
 * A contacts whose B contact has disappeared get the "Removed from B" label (never deleted).
 */

function syncDryRun() {
  const exportData = loadExport_();
  const aContacts = fetchAllContacts_();
  const plan = buildSyncPlan_(exportData, aContacts, findRemovedGroupRN_());
  writeSyncSheet_(plan, exportData);
  Logger.log('Sync plan (dry run): %s', JSON.stringify(plan.counts));
}

function syncApply() {
  const started = Date.now();
  const exportData = loadExport_();
  const plan = buildSyncPlan_(exportData, fetchAllContacts_(), findRemovedGroupRN_());
  checkSyncSafety_(plan, exportData);
  backupContacts();

  let writes = 0, failed = 0, stoppedEarly = false;
  const toLabel = [];
  for (let i = 0; i < plan.items.length; i++) {
    const it = plan.items[i];
    if (it.action === 'REVIEW') continue;
    if (it.action === 'REMOVED') { toLabel.push(it.a.resourceName); continue; }
    if (writes >= CONFIG.SYNC_MAX_WRITES || Date.now() - started > CONFIG.TIME_BUDGET_MS) { stoppedEarly = true; break; }
    try {
      if (it.action === 'CREATE') {
        People.People.createContact(buildCreateResource_(it.b));
      } else { // UPDATE or LINK
        const resource = Object.assign({ etag: it.a.etag }, it.resource);
        People.People.updateContact(resource, it.a.resourceName, { updatePersonFields: it.fields.join(',') });
      }
      writes++;
      Utilities.sleep(CONFIG.PAUSE_MS);
    } catch (e) {
      failed++;
      Logger.log('FAILED %s %s: %s', it.action, it.b ? displayName_(it.b) : displayName_(it.a), e);
    }
  }

  if (toLabel.length && !stoppedEarly) labelRemoved_(toLabel);
  Logger.log('Wrote %s contacts, labelled %s as removed, %s failures.%s',
    writes, stoppedEarly ? 0 : toLabel.length, failed, stoppedEarly ? ' Stopped early; run again for the rest.' : '');
}

function installWeeklySyncTrigger() {
  installWeekly_('syncApply', 6);
}

// ---------- export file ----------

function loadExport_() {
  const it = DriveApp.getFilesByName(CONFIG.SYNC_EXPORT_NAME);
  let best = null;
  while (it.hasNext()) {
    const f = it.next();
    if (!best || f.getLastUpdated() > best.getLastUpdated()) best = f;
  }
  if (!best) throw new Error('Export file "' + CONFIG.SYNC_EXPORT_NAME + '" not found. Run exportForSync() in B and share the file with this account.');
  const data = JSON.parse(best.getBlob().getDataAsString());
  const ageDays = (Date.now() - new Date(data.exportedAt).getTime()) / 86400000;
  if (!(ageDays <= CONFIG.SYNC_EXPORT_MAX_AGE_DAYS)) {
    throw new Error('Export is ' + Math.round(ageDays) + ' days old (max ' + CONFIG.SYNC_EXPORT_MAX_AGE_DAYS + '). Re-run exportForSync() in B.');
  }
  if (!data.contacts || !data.contacts.length) throw new Error('Export file has no contacts.');
  return data;
}

// ---------- planning ----------

function markerOf_(a) {
  const m = (a.externalIds || []).filter(function (e) { return e.type === CONFIG.SYNC_MARKER_TYPE; })[0];
  return m ? m.value : null;
}

function buildSyncPlan_(exportData, aContacts, removedGroupRN) {
  const bList = exportData.contacts || [];
  const bById = {};
  bList.forEach(function (b) { bById[b.id] = b; });

  const byMarker = {}, unmarked = [];
  let markedCount = 0;
  aContacts.forEach(function (a) {
    const m = markerOf_(a);
    if (m) { if (!byMarker[m]) byMarker[m] = a; markedCount++; } else unmarked.push(a);
  });

  const emailIdx = {}, phoneIdx = {}, nameIdx = {};
  const add = function (idx, k, a) { (idx[k] = idx[k] || []); if (idx[k].indexOf(a) === -1) idx[k].push(a); };
  unmarked.forEach(function (a) {
    emailKeys_(a).forEach(function (k) { add(emailIdx, k, a); });
    phoneKeys_(a).forEach(function (k) { add(phoneIdx, k, a); });
    const nm = normName_(a);
    if (nm.indexOf(' ') !== -1) add(nameIdx, nm, a);
  });

  const items = [];
  const counts = { OK: 0, UPDATE: 0, LINK: 0, CREATE: 0, REVIEW: 0, REMOVED: 0 };
  const claimed = {};
  const pending = [];
  const review = function (b, a, reason) { counts.REVIEW++; items.push({ action: 'REVIEW', b: b, a: a, reason: reason }); };

  // pass 1: contacts already linked by marker
  bList.forEach(function (b) {
    const a = byMarker[b.id];
    if (!a) { pending.push(b); return; }
    claimed[a.resourceName] = b.id;
    const d = diffOwned_(a, b);
    if (d.fields.length) { counts.UPDATE++; items.push({ action: 'UPDATE', a: a, b: b, fields: d.fields, resource: d.resource }); }
    else counts.OK++;
  });

  // pass 2: B contacts with no link yet
  pending.forEach(function (b) {
    let cands = [];
    const collect = function (list) { (list || []).forEach(function (a) { if (cands.indexOf(a) === -1) cands.push(a); }); };
    emailKeys_(b).forEach(function (k) { collect(emailIdx[k]); });
    phoneKeys_(b).forEach(function (k) { collect(phoneIdx[k]); });
    cands = cands.filter(function (a) { return namesCompatible_(a, b); });

    let via = 'shared email/phone';
    if (!cands.length) {
      const nm = normName_(b);
      if (nm.indexOf(' ') !== -1 && nameIdx[nm]) { cands = nameIdx[nm].slice(); via = 'name only'; }
    }
    if (!cands.length) {
      if (CONFIG.SYNC_CREATE_NEW) { counts.CREATE++; items.push({ action: 'CREATE', b: b }); }
      return;
    }
    if (cands.length > 1) { review(b, cands[0], 'Matches ' + cands.length + ' A contacts (' + via + ')'); return; }
    const a = cands[0];
    if (claimed[a.resourceName]) { review(b, a, 'A contact already linked to another B contact'); return; }
    if (via === 'name only' && CONFIG.SYNC_NAME_ONLY !== 'link') { review(b, a, 'Same name, nothing else in common'); return; }

    claimed[a.resourceName] = b.id;
    const d = diffOwned_(a, b);
    const ids = (a.externalIds || []).map(clean_).filter(function (e) { return e.type !== CONFIG.SYNC_MARKER_TYPE; });
    ids.push({ value: b.id, type: CONFIG.SYNC_MARKER_TYPE });
    d.resource.externalIds = ids;
    counts.LINK++;
    items.push({ action: 'LINK', a: a, b: b, fields: d.fields.concat(['externalIds']), resource: d.resource, reason: via });
  });

  // linked A contacts whose B contact is gone
  Object.keys(byMarker).forEach(function (id) {
    if (bById[id]) return;
    const a = byMarker[id];
    const labelled = removedGroupRN && (a.memberships || []).some(function (m) {
      return m.contactGroupMembership && m.contactGroupMembership.contactGroupResourceName === removedGroupRN;
    });
    if (labelled) return;
    counts.REMOVED++;
    items.push({ action: 'REMOVED', a: a });
  });

  return { items: items, counts: counts, markedCount: markedCount };
}

function checkSyncSafety_(plan, exportData) {
  if (plan.counts.CREATE > CONFIG.SYNC_MAX_CREATES) {
    throw new Error('Would create ' + plan.counts.CREATE + ' contacts (limit ' + CONFIG.SYNC_MAX_CREATES +
      '). Review the dry-run Sheet; raise SYNC_MAX_CREATES in Config.js if that is expected.');
  }
  if (plan.markedCount >= 20) {
    if (exportData.count < plan.markedCount * CONFIG.SYNC_MIN_EXPORT_RATIO) {
      throw new Error('Export has ' + exportData.count + ' contacts but ' + plan.markedCount + ' are linked; the export looks broken.');
    }
    if (plan.counts.REMOVED > plan.markedCount * CONFIG.SYNC_MAX_REMOVE_FRACTION) {
      throw new Error(plan.counts.REMOVED + ' of ' + plan.markedCount + ' linked contacts vanished from B; too many to label automatically.');
    }
  }
}

// ---------- field diff (B owns these) ----------

function phoneKey_(v) {
  const d = (v.value || '').replace(/\D/g, '');
  return (d.length >= CONFIG.MIN_PHONE_DIGITS ? d.slice(-CONFIG.PHONE_MATCH_DIGITS) : d) + '|' + (v.type || '').toLowerCase();
}

function addrKey_(v) {
  const s = v.formattedValue || [v.streetAddress, v.extendedAddress, v.city, v.region, v.postalCode, v.country].join(' ');
  return s.toLowerCase().replace(/[^a-z0-9]/g, '') + '|' + (v.type || '').toLowerCase();
}

function orgKey_(v) {
  return (v.name || '').trim().toLowerCase() + '|' + (v.title || '').trim().toLowerCase();
}

function bdayKey_(v) {
  const d = (v && v.date) || {};
  return [d.year || '', d.month || '', d.day || ''].join('-');
}

function pickName_(n) {
  const out = {};
  ['givenName', 'familyName', 'middleName', 'honorificPrefix', 'honorificSuffix'].forEach(function (k) { if (n[k]) out[k] = n[k]; });
  if (!Object.keys(out).length && n.displayName) out.unstructuredName = n.displayName;
  return out;
}

function nameKey_(n) {
  if (!n) return '';
  return ['givenName', 'middleName', 'familyName', 'honorificPrefix', 'honorificSuffix']
    .map(function (k) { return (n[k] || '').trim().toLowerCase(); }).join('|');
}

function cleanAddr_(v) {
  const c = clean_(v);
  const structured = ['streetAddress', 'extendedAddress', 'city', 'region', 'postalCode', 'country'].some(function (k) { return c[k]; });
  if (structured) delete c.formattedValue;
  return c;
}

/** Which A fields differ from B's, and the update resource that would fix them. */
function diffOwned_(a, b) {
  const fields = [], resource = {};
  const keys = function (list, fn) { return (list || []).map(fn).sort().join('\n'); };

  const bn = (b.names || [])[0];
  if (bn && nameKey_(pickName_(bn)) !== nameKey_((a.names || [])[0]) && (pickName_(bn).givenName || pickName_(bn).familyName)) {
    fields.push('names'); resource.names = [pickName_(bn)];
  }
  if ((b.phoneNumbers || []).length && keys(b.phoneNumbers, phoneKey_) !== keys(a.phoneNumbers, phoneKey_)) {
    fields.push('phoneNumbers'); resource.phoneNumbers = b.phoneNumbers.map(clean_);
  }
  if ((b.addresses || []).length && keys(b.addresses, addrKey_) !== keys(a.addresses, addrKey_)) {
    fields.push('addresses'); resource.addresses = b.addresses.map(cleanAddr_);
  }
  if ((b.organizations || []).length && keys(b.organizations, orgKey_) !== keys(a.organizations, orgKey_)) {
    fields.push('organizations'); resource.organizations = b.organizations.map(clean_);
  }
  if ((b.birthdays || []).length && bdayKey_(b.birthdays[0]) !== bdayKey_((a.birthdays || [])[0])) {
    fields.push('birthdays'); resource.birthdays = [clean_(b.birthdays[0])];
  }
  // emails: union, never remove
  const have = {};
  (a.emailAddresses || []).forEach(function (e) { have[(e.value || '').trim().toLowerCase()] = 1; });
  const missing = (b.emailAddresses || []).filter(function (e) { return !have[(e.value || '').trim().toLowerCase()]; });
  if (missing.length) {
    fields.push('emailAddresses');
    resource.emailAddresses = (a.emailAddresses || []).map(clean_).concat(missing.map(clean_));
  }
  return { fields: fields, resource: resource };
}

function buildCreateResource_(b) {
  const r = {};
  if ((b.names || [])[0]) r.names = [pickName_(b.names[0])];
  ['emailAddresses', 'phoneNumbers', 'organizations', 'birthdays'].forEach(function (f) { if ((b[f] || []).length) r[f] = b[f].map(clean_); });
  if ((b.addresses || []).length) r.addresses = b.addresses.map(cleanAddr_);
  r.externalIds = [{ value: b.id, type: CONFIG.SYNC_MARKER_TYPE }];
  return r;
}

// ---------- "Removed from B" label ----------

function findRemovedGroupRN_() {
  const names = fetchGroupNames_();
  const rns = Object.keys(names).filter(function (rn) { return names[rn] === CONFIG.SYNC_REMOVED_LABEL; });
  return rns.length ? rns[0] : null;
}

function labelRemoved_(resourceNames) {
  let rn = findRemovedGroupRN_();
  if (!rn) rn = People.ContactGroups.create({ contactGroup: { name: CONFIG.SYNC_REMOVED_LABEL } }).resourceName;
  for (let i = 0; i < resourceNames.length; i += 100) {
    People.ContactGroups.Members.modify({ resourceNamesToAdd: resourceNames.slice(i, i + 100) }, rn);
  }
}

// ---------- review sheet ----------

function summarizeField_(f, p) {
  const list = (p && p[f]) || [];
  if (f === 'names') return list[0] ? (list[0].displayName || nameKey_(list[0]).replace(/\|/g, ' ').trim()) : '';
  if (f === 'phoneNumbers' || f === 'emailAddresses') return list.map(function (x) { return x.value; }).join(', ');
  if (f === 'addresses') return list.map(function (x) { return x.formattedValue || [x.streetAddress, x.city, x.region, x.postalCode].filter(Boolean).join(' '); }).join(' | ');
  if (f === 'organizations') return list.map(function (x) { return [x.name, x.title].filter(Boolean).join(' / '); }).join(', ');
  if (f === 'birthdays') return list[0] ? bdayKey_(list[0]) : '';
  return '';
}

function writeSyncSheet_(plan, exportData) {
  const props = PropertiesService.getScriptProperties();
  let ss = null;
  const id = props.getProperty('SYNC_REVIEW_SS_ID');
  try { ss = id ? SpreadsheetApp.openById(id) : null; } catch (e) { ss = null; }
  if (!ss) {
    ss = SpreadsheetApp.create(CONFIG.SYNC_REVIEW_SPREADSHEET_NAME);
    props.setProperty('SYNC_REVIEW_SS_ID', ss.getId());
  }

  const rows = [['Action', 'B name', 'A name', 'Changes (A -> B)', 'Detail', 'B id', 'A id']];
  const order = { REVIEW: 0, CREATE: 1, LINK: 2, UPDATE: 3, REMOVED: 4 };
  plan.items.slice().sort(function (x, y) { return order[x.action] - order[y.action]; }).forEach(function (it) {
    const changes = (it.fields || []).filter(function (f) { return f !== 'externalIds'; }).map(function (f) {
      return f + ': "' + summarizeField_(f, it.a) + '" -> "' + summarizeField_(f, it.resource) + '"';
    }).join('\n');
    rows.push([it.action, it.b ? displayName_(it.b) : '', it.a ? displayName_(it.a) : '', changes,
      it.reason || (it.action === 'CREATE' ? 'No match in A' : it.action === 'REMOVED' ? 'No longer in B' : ''),
      it.b ? it.b.id : '', it.a ? it.a.resourceName : '']);
  });
  const sheet = ss.getSheetByName('Plan') || ss.insertSheet('Plan');
  sheet.clear();
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 4, rows.length, 1).setWrap(true);

  const sum = ss.getSheetByName('Summary') || ss.insertSheet('Summary');
  sum.clear();
  const srows = [['Export taken', exportData.exportedAt], ['B contacts in export', exportData.count], ['A contacts already linked', plan.markedCount]];
  Object.keys(plan.counts).forEach(function (k) { srows.push([k, plan.counts[k]]); });
  sum.getRange(1, 1, srows.length, 2).setValues(srows);
  Logger.log('Sync review sheet: %s', ss.getUrl());
}
