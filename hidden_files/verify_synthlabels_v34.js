// verify_synthlabels_v34.js — tests for the v0.34 synthetic-label honesty pass.
// Checks: (1) all 249 records carry _alumni_giving_source/_employment_6mo_source
// = "synthetic (placeholder)", distinct ids/Scorecard IDs preserved, key order
// has source fields following their base fields; (2) js/app.js detail panel
// renders empLabel/givLabel with the research-mirror gray "synthetic
// placeholder" suffix in the Outcomes block; (3) index.html methodology cards
// no longer claim (IPEDS, CASE)/(IPEDS + surveys) for these fields; (4)
// metadata version bumped to 0.34.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

let pass = 0, fail = 0;
function t(name, cond) { if (cond) { pass++; } else { fail++; console.error('FAIL:', name); } }

const d = JSON.parse(fs.readFileSync(path.join(root, 'data/universities.json'), 'utf8'));
const recs = d.universities;
t('249 records', recs.length === 249);
t('metadata version 0.34', d.metadata.version === '0.34');
t('all alumni_giving synthetic-labeled',
  recs.every(r => r._alumni_giving_source === 'synthetic (placeholder)'));
t('all employment_6mo synthetic-labeled',
  recs.every(r => r._employment_6mo_source === 'synthetic (placeholder)'));
t('distinct internal ids', new Set(recs.map(r => r.id)).size === 249);
t('distinct Scorecard IDs', new Set(recs.map(r => r.scorecard_id)).size === 249);
const keys = Object.keys(recs[0]);
t('_alumni_giving_source follows alumni_giving',
  keys.indexOf('_alumni_giving_source') === keys.indexOf('alumni_giving') + 1);
t('_employment_6mo_source follows employment_6mo',
  keys.indexOf('_employment_6mo_source') === keys.indexOf('employment_6mo') + 1);
t('no score values changed (formula untouched)',
  recs.every(r => typeof r.score === 'number' && r.score >= 55 && r.score <= 97));

const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
t('app.js defines empLabel from _employment_6mo_source',
  app.includes('_employment_6mo_source') && app.includes('const empLabel'));
t('app.js defines givLabel from _alumni_giving_source',
  app.includes('_alumni_giving_source') && app.includes('const givLabel'));
t('app.js Outcomes block renders empLabel suffix',
  app.includes('Employment 6mo: ${(u.employment_6mo*100).toFixed(0)}%${synthGray}(${empLabel})</span>'));
t('app.js Outcomes block renders givLabel suffix',
  app.includes('Alumni Giving: ${(u.alumni_giving*100).toFixed(0)}%${synthGray}(${givLabel})</span>'));
t('app.js synthetic wording matches researchLabel wording',
  app.includes("'synthetic placeholder'") );

const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
t('methodology no longer claims IPEDS+surveys for employment',
  !idx.includes('Employment 6mo (IPEDS + surveys)'));
t('methodology no longer claims IPEDS,CASE for alumni giving',
  !idx.includes('Alumni giving rate (IPEDS, CASE)'));
t('methodology labels employment as placeholder honestly',
  idx.includes('Employment 6mo (estimated placeholder'));
t('methodology labels alumni giving as placeholder honestly',
  idx.includes('Alumni giving rate (estimated placeholder'));
t('badge bumped to v0.34', idx.includes('249 Universities v0.34'));

const probe = fs.readFileSync(
  path.join(root, 'data/raw/alumni-giving-probe/2026-09-26/README.md'), 'utf8');
t('probe artifact documents IPEDS aggregate-gifts limitation',
  probe.toLowerCase().includes('no alumni breakout'));
t('probe artifact documents CASE subscription gate',
  probe.includes('subscription-only'));

console.log(`synthlabels v34: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
