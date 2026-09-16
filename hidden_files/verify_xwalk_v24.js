// v0.24 unit tests: buildCrosswalkLinks (mechanically extracted from js/app.js)
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../js/app.js', 'utf8');
const m = src.match(/\/\/ CARNEGIE-CROSSWALK-V24-BEGIN\n([\s\S]*?)\n  \/\/ CARNEGIE-CROSSWALK-V24-END/);
if (!m) { console.error('FAIL: markers not found'); process.exit(1); }
const buildCrosswalkLinks = new Function('nodes', 'k', m[1] + '\nreturn buildCrosswalkLinks(nodes,k);');

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; } else { fail++; console.error('FAIL:', name); } };

const N = (id, carnegie, conf, score) => ({ id, name: 'N-' + id, carnegie, conf, group: conf, score });
const nodes = [
  N('a', 'R1', 'Big Ten', 90),
  N('b', 'R1', 'SEC', 88),
  N('c', 'R1', 'ACC', 70),
  N('d', 'R1', 'Big Ten', 60),   // same conf as a -> never linked to a
  N('e', 'R2', 'SEC', 85),
  N('f', 'R2', 'Big Ten', 84),
  N('g', 'Baccalaureate', 'NESCAC', 95),
  N('h', 'Baccalaureate', 'SCIAC', 50),
  N('i', null, 'MAC', 40),       // missing carnegie -> 'Other'
  N('j', null, 'CUSA', 41),
];

const links = buildCrosswalkLinks(nodes, 2);

// 1. crosswalk constraint: same carnegie, different conf, no self-links
const byId = {}; nodes.forEach(n => byId[n.id] = n);
links.forEach(l => {
  const s = byId[l.source], t = byId[l.target];
  ok(s.id !== t.id, 'no self-link ' + s.id);
  ok((s.carnegie || 'Other') === (t.carnegie || 'Other'), 'same carnegie ' + s.id + '/' + t.id);
  ok((s.conf || 'Other') !== (t.conf || 'Other'), 'different conf ' + s.id + '/' + t.id);
  ok(l.xwalk === true, 'xwalk flag ' + s.id + '/' + t.id);
});

// 2. no duplicate unordered pairs
const pairs = links.map(l => [l.source, l.target].sort().join('|'));
ok(new Set(pairs).size === pairs.length, 'no duplicate pairs');

// 3. per-node cap: every node is source of at most k links
const outCount = {};
links.forEach(l => { outCount[l.source] = (outCount[l.source] || 0) + 1; });
ok(Object.values(outCount).every(c => c <= 2), 'per-node cap k=2');

// 4. score-nearest first: a (R1,90) should link b (88, delta 2) before c (70, delta 20)
const aLinks = links.filter(l => l.source === 'a').map(l => l.target);
ok(aLinks[0] === 'b', 'score-nearest ordering: a->b first, got ' + JSON.stringify(aLinks));

// 5. same-conf never linked: a-d share Big Ten
ok(!pairs.includes('a|d'), 'a-d (same conf) never linked');

// 6. missing carnegie buckets to Other and still crosswalks across confs
ok(links.some(l => (l.source === 'i' && l.target === 'j') || (l.source === 'j' && l.target === 'i')), 'Other-carnegie crosswalk i<->j');

// 7. determinism: same input -> identical output
const again = buildCrosswalkLinks(nodes, 2);
ok(JSON.stringify(again) === JSON.stringify(links), 'deterministic');

// 8. singleton tier: g has h as only partner; h has g
const gOut = links.filter(l => l.source === 'g');
ok(gOut.length === 1 && gOut[0].target === 'h', 'singleton-tier links');

// 9. total volume sane on the real 200 (each node up to 3, pairs deduped)
const real = JSON.parse(fs.readFileSync(__dirname + '/../data/universities.json', 'utf8')).universities;
const realNodes = real.map(u => ({ id: u.id, name: u.name, carnegie: u.carnegie, conf: u.conference || u.peer_group || 'Other', group: u.conference || u.peer_group || 'Other', score: u.score }));
const realLinks = buildCrosswalkLinks(realNodes, 2);
ok(realLinks.length > 50 && realLinks.length <= 200 * 2, 'real-200 volume: ' + realLinks.length);
const rp = realLinks.map(l => [l.source, l.target].sort().join('|'));
ok(new Set(rp).size === rp.length, 'real-200 no dup pairs');
const rc = {}; realLinks.forEach(l => { const s = realNodes.find(n => n.id === l.source), t = realNodes.find(n => n.id === l.target); rc[l.source] = (rc[l.source] || 0) + 1; });
ok(Object.values(rc).every(c => c <= 2), 'real-200 per-node cap k=2');
// spot-check: MIT and Caltech (R1, different confs) should plausibly link
const mitCal = rp.includes(['mit', 'caltech'].sort().join('|')) || rp.includes(['mit', 'stanford'].sort().join('|'));
console.log('info: MIT crosswalk present:', mitCal, '| total crosswalk links:', realLinks.length);

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
