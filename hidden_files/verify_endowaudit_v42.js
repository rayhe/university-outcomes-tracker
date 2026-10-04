// verify_endowaudit_v42.js — tests for the v0.42 endowment staleness audit.
// Checks: (1) the 4 updated records carry the expected _endowment_source
// values and recomputed endowment_per_student; (2) the lawrence record has
// the _identity_source annotation for the v0.32 St. Lawrence misattribution;
// (3) the 29 kept records were untouched (spot-check stale keepers);
// (4) no record regressed to synthetic (249/249 real); (5) 0 score movers;
// (6) raw artifacts exist for the audit.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');

let pass = 0, fail = 0;
function t(name, cond) { if (cond) { pass++; } else { fail++; console.error('FAIL:', name); } }

const d = JSON.parse(fs.readFileSync(path.join(root, 'data/universities.json'), 'utf8'));
const recs = d.universities;
const byid = Object.fromEntries(recs.map(r => [r.id, r]));

t('249 records', recs.length === 249);
t('metadata version 0.42', d.metadata.version === '0.42');
t('metadata carries endowment_audit_v42 note', typeof d.metadata.endowment_audit_v42 === 'string');

const EXPECTED = {
  morehouse: ['Wikipedia infobox (2024): $275M (as of 2025)', 0.275],
  umkc:      ['Wikipedia infobox (2026): $254M (UMKC only, as of June 30, 2026)', 0.254],
  knox:      ['Wikipedia infobox (2025): $176.6M', 0.1766],
  lawrence:  ['Wikipedia infobox (2025): $456.6M', 0.4566],
};
for (const [id, [src, val]] of Object.entries(EXPECTED)) {
  const u = byid[id];
  t(id + ' source label', u._endowment_source === src);
  t(id + ' endowment_b', u.endowment_b === val);
  t(id + ' endowment_per_student recomputed',
    u.endowment_per_student === Math.round(u.endowment_b * 1e9 / u.enrollment_fte));
}
t('lawrence identity annotation names St. Lawrence',
  (byid.lawrence._identity_source || '').includes('St. Lawrence University'));

// spot-check keepers: values that should NOT have changed
const KEEP = {
  akron:        ['Wikipedia infobox (as of June 30, 2020): $235.3M - stale, latest available', 0.2353],
  jacksonstate: ['Wikipedia infobox (2019): $60 million (2019), Jackson State University, fetched 2026-09-24', 0.06],
  alabamaam:    ['Wikipedia infobox (2019): $48.0&nbsp;million (2019), Alabama A&M University, fetched 2026-09-24', 0.048],
  lmu:          ['Wikipedia infobox (2024): $722.7M, Loyola Marymount', 0.72],
  hampton:      ['Wikipedia infobox (2020): $280.6 million (2020), Hampton University, fetched 2026-09-24', 0.2806],
  scstate:      ['Wikipedia infobox (2023): $17.2 million (2023), South Carolina State University, fetched 2026-09-24', 0.0172],
};
for (const [id, [src, val]] of Object.entries(KEEP)) {
  const u = byid[id];
  t(id + ' kept (source)', u._endowment_source === src);
  t(id + ' kept (value)', u.endowment_b === val);
}

t('no synthetic endowment remaining',
  recs.every(r => r._endowment_source !== 'synthetic (placeholder)'));
t('distinct internal ids', new Set(recs.map(r => r.id)).size === 249);
t('distinct Scorecard IDs', new Set(recs.map(r => r.scorecard_id)).size === 249);

// 0 score movers vs HEAD
const old = JSON.parse(execSync('git show HEAD:data/universities.json', {cwd: root}).toString());
const oldScore = Object.fromEntries(old.universities.map(r => [r.id, r.score]));
t('0 score movers', recs.every(r => r.score === oldScore[r.id]));

// raw artifacts
const rawdir = path.join(root, 'data/raw/endowment-wikipedia/2026-10-04');
t('fetch artifact infobox_extract.json exists (33)', (() => {
  try { return JSON.parse(fs.readFileSync(path.join(rawdir, 'infobox_extract.json'), 'utf8')).length === 33; }
  catch (e) { return false; }
})());
t('refetch_correct_pages.json exists (4 explicit-title refetches)', (() => {
  try { return JSON.parse(fs.readFileSync(path.join(rawdir, 'refetch_correct_pages.json'), 'utf8')).length === 5; }
  catch (e) { return false; }
})());
t('review.tsv exists', fs.existsSync(path.join(rawdir, 'review.tsv')));

console.log(pass + '/' + (pass + fail) + ' pass');
process.exit(fail ? 1 : 0);
