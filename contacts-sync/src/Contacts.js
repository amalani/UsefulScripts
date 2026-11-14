/** People API helpers and normalization shared by Backup and Dedupe. */

const PERSON_FIELDS = [
  'names', 'nicknames', 'emailAddresses', 'phoneNumbers', 'addresses',
  'organizations', 'birthdays', 'events', 'biographies', 'urls',
  'userDefined', 'memberships', 'relations', 'externalIds', 'metadata'
].join(',');

/** All of "my contacts" (not "other contacts"), following pagination. */
function fetchAllContacts_() {
  const out = [];
  let token;
  do {
    const res = People.People.Connections.list('people/me', {
      personFields: PERSON_FIELDS,
      pageSize: 1000,
      pageToken: token,
      sources: ['READ_SOURCE_TYPE_CONTACT']
    });
    (res.connections || []).forEach(function (p) { out.push(p); });
    token = res.nextPageToken;
  } while (token);
  return out;
}

/** Map of contactGroup resourceName -> label name, for readable backups. */
function fetchGroupNames_() {
  const map = {};
  let token;
  do {
    const res = People.ContactGroups.list({ pageSize: 200, pageToken: token });
    (res.contactGroups || []).forEach(function (g) {
      map[g.resourceName] = g.formattedName || g.name;
    });
    token = res.nextPageToken;
  } while (token);
  return map;
}

function displayName_(p) {
  const n = (p.names || [])[0];
  return n ? (n.displayName || '') : '';
}

function normName_(p) {
  return displayName_(p).toLowerCase().replace(/[^a-z0-9À-￿ ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function emailKeys_(p) {
  return (p.emailAddresses || [])
    .map(function (e) { return (e.value || '').trim().toLowerCase(); })
    .filter(Boolean);
}

function phoneKeys_(p) {
  return (p.phoneNumbers || [])
    .map(function (ph) { return (ph.value || '').replace(/\D/g, ''); })
    .filter(function (d) { return d.length >= CONFIG.MIN_PHONE_DIGITS; })
    .map(function (d) { return d.slice(-CONFIG.PHONE_MATCH_DIGITS); });
}

/** Loose "could these be the same person?" check on display names. */
function namesCompatible_(a, b) {
  const na = normName_(a), nb = normName_(b);
  if (!na || !nb || na === nb) return true; // email/phone-only contacts are compatible
  const ta = na.split(' '), tb = nb.split(' ');
  const subset = function (x, y) { return x.every(function (t) { return y.indexOf(t) !== -1; }); };
  if (subset(ta, tb) || subset(tb, ta)) return true;
  // same first name and same last-name initial (e.g. "Rob Smith" / "Robert S.")
  return ta[0] === tb[0] && ta[ta.length - 1].charAt(0) === tb[tb.length - 1].charAt(0);
}

function oneLine_(p) {
  return displayName_(p) + ' <' + emailKeys_(p).join(', ') + '> ' +
    (p.phoneNumbers || []).map(function (x) { return x.value; }).join(', ');
}
