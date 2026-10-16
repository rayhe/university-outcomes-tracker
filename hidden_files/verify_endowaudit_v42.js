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
t('metadata version is well-formed N.NN (not stale-pinned to 0.42)', /^\d+\.\d+$/.test(d.metadata.version || ''));
t('index badge version matches metadata version (not stale-pinned)',
  fs.readFileSync(path.join(root, 'index.html'), 'utf8').includes('249 Universities v' + d.metadata.version));
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

// spot-check keepers: values that should NOT have changed since v0.42.
// Four of the six were legitimately refreshed by the v0.48 freshness
// re-probe (IPEDS Finance FY2024 via Data USA); expectations updated to the
// v0.48 values so the suite tracks the data it actually runs against.
// The v0.42 values remain recorded in the iteration log (v0.42 entry).
const KEEP = {
  akron:        ['Data USA (IPEDS Finance FY2024 via datausa.io): $352M University of Akron Main Campus, verified 2026-10-10', 0.352],
  jacksonstate: ['Data USA (IPEDS Finance FY2024 via datausa.io): $61M Jackson State University, verified 2026-10-10', 0.061],
  alabamaam:    ['Wikipedia infobox (2019): $48.0&nbsp;million (2019), Alabama A&M University, fetched 2026-09-24', 0.048],
  lmu:          ['Wikipedia infobox (2024): $722.7M, Loyola Marymount', 0.72],
  hampton:      ['Data USA (IPEDS Finance FY2024 via datausa.io): $241M Hampton University, verified 2026-10-10', 0.241],
  scstate:      ['Data USA (IPEDS Finance FY2024 via datausa.io): $19.7M South Carolina State University, verified 2026-10-10', 0.0197],
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

// v0.54 supersede: the original "0 score movers vs HEAD" guard applied to
// metadata/copy-only runs. v0.54 refreshed Scorecard earnings on the new ED
// release, so scores legitimately moved (240 movers; e.g. Caltech 91.9->97.0
// now tops, MIT 97.0->93.1). The correct invariant is strictly stronger: every
// score must equal the v0.10 formula recompute on the CURRENT record
// (min-max to [55,97]; 0.06 tolerance covers Python round-half-even vs JS).
const raws = recs.map(u => {
  const earn = u.median_earn_10yr || 50000;
  const gr = u.grad_rate_6yr || 0.6;
  const ret = u.retention || 0.8;
  const adm = u.admission_rate == null ? 0.7 : u.admission_rate;
  let b = 60 + (earn - 45000) / 1200 * 0.8 + gr * 15 + ret * 8 + (1 - adm) * 6;
  if (u.control === 'private' && u.carnegie === 'Baccalaureate') b += 3;
  return b;
});
const rlo = Math.min(...raws), rhi = Math.max(...raws);
t('scores match v0.10 formula recompute on current data (55-97 min-max)',
  recs.every((u, i) => Math.abs(u.score - (55.0 + (raws[i] - rlo) / (rhi - rlo) * 42.0)) < 0.06));

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
