// verify_cohort_v33.js — unit tests for the COHORT-V33 cohort helpers in js/app.js.
// The tested block is mechanically extracted between the COHORT-V33 markers
// (no transcription): extraction is positional, so this fails loudly if the
// block moves or the markers change.
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../js/app.js', 'utf8');
const start = src.indexOf('// COHORT-V33-START');
const end = src.indexOf('// COHORT-V33-END');
if (start < 0 || end < 0 || end < start) { console.error('FAIL: COHORT-V33 markers not found'); process.exit(1); }
const block = src.slice(start, end);
const { cohortPred, cohortStats, cohortROI } = new Function(block + '; return {cohortPred,cohortStats,cohortROI};')();

let pass = 0, fail = 0;
function t(name, cond) { if (cond) { pass++; } else { fail++; console.error('FAIL:', name); } }

// --- cohortPred ---
const hPred = cohortPred('hbcu');
t('hbcu flag true matches', hPred({ hbcu: true }) === true);
t('hbcu absent does not match', hPred({}) === false);
t('hbcu false does not match', hPred({ hbcu: false }) === false);
const lPred = cohortPred('lac');
t('lac Baccalaureate matches', lPred({ carnegie: 'Baccalaureate' }) === true);
t('lac R1 does not match', lPred({ carnegie: 'R1' }) === false);
t('lac R2 does not match', lPred({ carnegie: 'R2' }) === false);
const aPred = cohortPred('all');
t('all passes hbcu school', aPred({ hbcu: true }) === true);
t('all passes plain school', aPred({}) === true);
const gPred = cohortPred('garbage-value');
t('unknown cohort passes through (never filters)', gPred({ hbcu: true }) === true && gPred({}) === true);

// --- cohortROI (hand calc) ---
// earn 80000 - 70000 - 4*20000 = -70000
t('cohortROI hand calc', cohortROI({ median_earn_10yr: 80000, net_price_avg: 20000 }) === -70000);

// --- cohortStats on a 4-school fixture ---
const fixture = [
  { id: 'b', name: 'Beta', score: 80, median_earn_10yr: 60000, net_price_avg: 10000, endowment_per_student: 200000, hbcu: true, carnegie: 'R2' },
  { id: 'a', name: 'Alpha', score: 90, median_earn_10yr: 100000, net_price_avg: 20000, endowment_per_student: 400000, hbcu: true, carnegie: 'R1' },
  { id: 'd', name: 'Delta', score: 90, median_earn_10yr: 90000, net_price_avg: 15000, endowment_per_student: 300000, hbcu: true, carnegie: 'Baccalaureate' },
  { id: 'c', name: 'Gamma', score: 70, median_earn_10yr: 50000, net_price_avg: 12000, endowment_per_student: 100000, hbcu: false, carnegie: 'R1' },
];
const s = cohortStats(fixture, cohortPred('hbcu'));
t('fixture n=3', s.n === 3);
t('fixture avgScore 86.666', Math.abs(s.avgScore - 260 / 3) < 1e-9);
t('fixture avgEarn 83333.33', Math.abs(s.avgEarn - 250000 / 3) < 1e-9);
t('fixture medianEarn 90000', s.medianEarn === 90000);
t('fixture medianEndowStud 300000', s.medianEndowStud === 300000);
// ROIs: beta -50000, alpha -50000, delta -40000 -> median -50000
t('fixture medianROI -50000', s.medianROI === -50000);
t('fixture top tie broken by id -> Alpha', s.topName === 'Alpha' && s.topScore === 90);
const sAll = cohortStats(fixture, cohortPred('all'));
t('fixture all n=4', sAll.n === 4);
const sNone = cohortStats(fixture, () => false);
t('empty cohort returns n=0', sNone.n === 0);

// --- real-249 smoke ---
const data = JSON.parse(fs.readFileSync(__dirname + '/../data/universities.json', 'utf8'));
const unis = data.universities;
t('real universe 249', unis.length === 249);
const hb = cohortStats(unis, cohortPred('hbcu'));
t('real hbcu n=21', hb.n === 21);
const lc = cohortStats(unis, cohortPred('lac'));
t('real lac n=43', lc.n === 43);
t('real hbcu avgScore sane', hb.avgScore > 50 && hb.avgScore < 90);
t('real lac avgScore sane', lc.avgScore > 50 && lc.avgScore < 90);
t('real topScore >= avgScore (hbcu)', hb.topScore >= hb.avgScore);
t('real medianROI finite', Number.isFinite(hb.medianROI) && Number.isFinite(lc.medianROI));
// cross-check against a direct recompute (independent of cohortStats internals)
const direct = unis.filter(u => u.hbcu === true).reduce((s, u) => s + u.score, 0) / 21;
t('real hbcu avgScore matches direct', Math.abs(hb.avgScore - direct) < 1e-9);
t('real hbcu top is a real name', typeof hb.topName === 'string' && hb.topName.length > 3);

console.log(`cohort v33: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
