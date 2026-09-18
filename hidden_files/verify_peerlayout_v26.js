// verify_peerlayout_v26.js — unit tests for the PEER-LAYOUT-V26 pure helpers.
// The tested block is mechanically extracted from js/app.js between the
// PEER-LAYOUT-V26-BEGIN / PEER-LAYOUT-V26-END markers (no transcription).
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const BEGIN = '// PEER-LAYOUT-V26-BEGIN', END = '// PEER-LAYOUT-V26-END';
const a = src.indexOf(BEGIN), b = src.indexOf(END);
if (a < 0 || b < 0 || b < a) { console.error('markers not found'); process.exit(2); }
const code = src.slice(a + BEGIN.length, b);
const api = new Function(code + '; return {peerLayoutHash, peerLayoutKey, savePeerLayout, loadPeerLayout, applySavedLayout, clearPeerLayout};')();
const { peerLayoutHash, peerLayoutKey, savePeerLayout, loadPeerLayout, applySavedLayout, clearPeerLayout } = api;

function fakeStorage() {
  const m = {};
  return {
    getItem: k => (k in m ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
    removeItem: k => { delete m[k]; },
    key: i => Object.keys(m)[i],
    get length() { return Object.keys(m).length; },
    _m: m
  };
}

let pass = 0, fail = 0;
function t(name, cond) { if (cond) { pass++; } else { fail++; console.error('FAIL:', name); } }

// --- key: deterministic, mode-sensitive, id-order-insensitive, id-set-sensitive
t('key deterministic', peerLayoutKey('conference', ['a','b','c']) === peerLayoutKey('conference', ['a','b','c']));
t('key mode-sensitive', peerLayoutKey('conference', ['a','b']) !== peerLayoutKey('carnegie', ['a','b']));
t('key order-insensitive', peerLayoutKey('conference', ['a','b','c']) === peerLayoutKey('conference', ['c','a','b']));
t('key id-set-sensitive', peerLayoutKey('conference', ['a','b']) !== peerLayoutKey('conference', ['a','b','c']));
t('key format', /^uot_peer_layout_conference_[0-9a-f]+$/.test(peerLayoutKey('conference', ['x'])));
t('hash stable on string', peerLayoutHash('abc') === peerLayoutHash('abc'));
t('hash differs', peerLayoutHash('abc') !== peerLayoutHash('abd'));

// --- save -> load round-trip, normalized coords
{
  const st = fakeStorage();
  const nodes = [{ id: 'u1', x: 500, y: 220 }, { id: 'u2', x: 100, y: 44 }];
  const key = savePeerLayout(st, 'conference', ['u1', 'u2'], nodes, 1000, 440);
  t('save returns key', key === peerLayoutKey('conference', ['u1', 'u2']));
  const loaded = loadPeerLayout(st, 'conference', ['u2', 'u1']); // order-insensitive
  t('load round-trip', loaded && Math.abs(loaded.u1[0] - 0.5) < 1e-4 && Math.abs(loaded.u2[1] - 0.1) < 1e-4);
  const parsed = JSON.parse(st._m[key]);
  t('stored ids sorted', JSON.stringify(parsed.ids) === '["u1","u2"]');
  t('coords normalized [0,1]', Object.values(parsed.pos).every(p => p[0] >= 0 && p[0] <= 1 && p[1] >= 0 && p[1] <= 1));
}

// --- load guards: drift, corruption, missing, null storage
{
  const st = fakeStorage();
  const nodes = [{ id: 'u1', x: 10, y: 10 }];
  savePeerLayout(st, 'conference', ['u1'], nodes, 100, 100);
  t('load null on id-set drift', loadPeerLayout(st, 'conference', ['u1', 'u2']) === null);
  t('load null on mode mismatch', loadPeerLayout(st, 'carnegie', ['u1']) === null);
  t('load null on missing key', loadPeerLayout(fakeStorage(), 'conference', ['u1']) === null);
  t('load null on null storage', loadPeerLayout(null, 'conference', ['u1']) === null);
  const st2 = fakeStorage();
  st2.setItem(peerLayoutKey('conference', ['u1']), '{broken json');
  t('load null on corrupt JSON', loadPeerLayout(st2, 'conference', ['u1']) === null);
  const st3 = fakeStorage();
  st3.setItem(peerLayoutKey('conference', ['u1']), JSON.stringify({ ids: ['u1'] })); // no pos
  t('load null on missing pos', loadPeerLayout(st3, 'conference', ['u1']) === null);
}

// --- save prefers pinned fx/fy, guards on bad args
{
  const st = fakeStorage();
  const nodes = [{ id: 'u1', x: 999, y: 999, fx: 250, fy: 110 }];
  savePeerLayout(st, 'conference', ['u1'], nodes, 1000, 440);
  const loaded = loadPeerLayout(st, 'conference', ['u1']);
  t('save uses fx/fy when pinned', Math.abs(loaded.u1[0] - 0.25) < 1e-4 && Math.abs(loaded.u1[1] - 0.25) < 1e-4);
  t('save null storage', savePeerLayout(null, 'conference', ['u1'], nodes, 1000, 440) === null);
  t('save zero w', savePeerLayout(st, 'conference', ['u1'], nodes, 0, 440) === null);
}

// --- applySavedLayout: scale, clamp, pin, count, skip missing
{
  const st = fakeStorage();
  const nodes = [{ id: 'u1', x: 500, y: 220 }, { id: 'u2', x: 100, y: 44 }];
  savePeerLayout(st, 'conference', ['u1', 'u2'], nodes, 1000, 440);
  const loaded = loadPeerLayout(st, 'conference', ['u1', 'u2']);
  const n2 = [{ id: 'u1', x: 0, y: 0 }, { id: 'u2', x: 0, y: 0 }, { id: 'u3', x: 5, y: 5 }];
  const applied = applySavedLayout(n2, loaded, 700, 440); // narrower canvas: x scales
  t('apply count skips unknown ids', applied === 2);
  t('apply scales to new w', Math.abs(n2[0].x - 350) < 0.01 && Math.abs(n2[0].y - 220) < 0.01);
  t('apply pins fx/fy', n2[0].fx === n2[0].x && n2[0].fy === n2[0].y);
  t('apply leaves unknown node unpinned', n2[2].fx === undefined && n2[2].x === 5);
  const n3 = [{ id: 'u1' }];
  applySavedLayout(n3, { u1: [2.0, -0.5] }, 700, 440); // out-of-range normalized
  t('apply clamps out-of-range', n3[0].x === 688 && n3[0].y === 16);
}

// --- clearPeerLayout: only matching mode prefix, returns count
{
  const st = fakeStorage();
  savePeerLayout(st, 'conference', ['u1'], [{ id: 'u1', x: 1, y: 1 }], 100, 100);
  savePeerLayout(st, 'carnegie', ['u1'], [{ id: 'u1', x: 1, y: 1 }], 100, 100);
  t('clear removes only mode keys', clearPeerLayout(st, 'conference') === 1);
  t('other mode survives clear', loadPeerLayout(st, 'carnegie', ['u1']) !== null);
  t('cleared key gone', loadPeerLayout(st, 'conference', ['u1']) === null);
  t('clear empty returns 0', clearPeerLayout(fakeStorage(), 'conference') === 0);
  t('clear null storage returns 0', clearPeerLayout(null, 'conference') === 0);
}

// --- integration-shaped: move -> save -> restore with pinned fx kept (dragend keeps pins)
{
  const st = fakeStorage();
  const nodes = [{ id: 'a', x: 10, y: 10 }, { id: 'b', x: 20, y: 20 }];
  nodes[0].fx = 300; nodes[0].fy = 200; // what dragend now leaves behind
  savePeerLayout(st, 'conference', ['a', 'b'], nodes, 800, 440);
  const restored = loadPeerLayout(st, 'conference', ['a', 'b']);
  const n2 = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 0, y: 0 }];
  applySavedLayout(n2, restored, 800, 440);
  t('pinned drag position survives save/restore', Math.abs(n2[0].x - 300) < 0.1 && Math.abs(n2[0].y - 200) < 0.1 && n2[0].fx === n2[0].x);
  t('unpinned node restores too', Math.abs(n2[1].x - 20) < 0.1 && n2[1].fx === n2[1].x);
}

console.log(`peerlayout v26: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
