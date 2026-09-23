// verify_mappeerlink_v30.js — unit test for the MAP-PEERLINK-V30 block in js/app.js.
// The block is mechanically extracted between MAP-PEERLINK-V30-BEGIN/END markers
// (no transcription); run with `new Function` scope.
// Usage: node hidden_files/verify_mappeerlink_v30.js

const fs=require('fs'), path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','js','app.js'),'utf8');
const m=src.match(/\/\/ MAP-PEERLINK-V30-BEGIN\n([\s\S]*?)\/\/ MAP-PEERLINK-V30-END/);
if(!m){ console.error('FAIL: markers not found'); process.exit(1); }
const scope=new Function(m[1]+'; return {mapLinkProps, mapPeerLinks, escMapLink, mapPeerLinkTip};');
const {mapLinkProps, mapPeerLinks, escMapLink, mapPeerLinkTip}=scope();

let pass=0, fail=0;
function ok(cond, label){ if(cond){pass++;} else {fail++; console.error('FAIL:',label);} }

// --- mapLinkProps: same weighting formula as PEER-LINK-V28 peerLinkProps with the always-on same-pg bonus ---
let p=mapLinkProps({score:85},{score:85});
ok(p.dist===20 && p.str===0.46, 'gap 0 -> dist 20, str 0.46 (same-pg bonus applied)');
p=mapLinkProps({score:90},{score:60});
ok(p.dist===62 && p.str===0.22, 'gap 30 -> dist 62, str 0.22 (matches v0.28 hand-calc)');
p=mapLinkProps({score:100},{score:0});
ok(p.dist===72 && p.str===0.22, 'gap 100 saturates dist cap at 72, str floor at 0.22');
p=mapLinkProps({score:null},{score:undefined});
ok(p.dist===20 && p.str===0.46, 'missing scores coerce to 0 (gap 0)');
ok(mapLinkProps({score:55},{score:97}).str>=0.22 && mapLinkProps({score:55},{score:97}).str<=0.46, 'str bounded in [0.22,0.46]');

// --- mapPeerLinks: grouping, dedupe, k cap, top-12 cap, determinism ---
const fixture=[
  {id:'a1', name:'A One', score:90, peer_group:'Ivy League', lon:-74.0, lat:40.7},
  {id:'a2', name:'A Two', score:88, peer_group:'Ivy League', lon:-73.9, lat:40.8},
  {id:'a3', name:'A Three', score:70, peer_group:'Ivy League', lon:-74.1, lat:40.6},
  {id:'b1', name:'B One', score:85, peer_group:'Big Ten', lon:-83.0, lat:42.3},
  {id:'b2', name:'B Two', score:83, peer_group:'Big Ten', lon:-82.9, lat:42.4},
  {id:'c1', name:'C One', score:80, peer_group:null, lon:-122.0, lat:37.4},
  {id:'c2', name:'C Two', score:78, peer_group:null, lon:-122.1, lat:37.3},
  {id:'nolat', name:'No Loc', score:99, peer_group:'Ivy League'},
  {name:'No ID', score:99, peer_group:'Ivy League', lon:-74.0, lat:40.7},
];
const links=mapPeerLinks(fixture, 2);
ok(links.every(l=>l.a.id!==l.b.id), 'no self-links');
const pairKeys=links.map(l=>[l.a.id,l.b.id].sort().join('|'));
ok(new Set(pairKeys).size===pairKeys.length, 'pairs deduped');
ok(links.every(l=>((l.a.peer_group||'Other')===(l.b.peer_group||'Other'))), 'all links intra-peer_group (nulls group as Other)');
ok(links.every(l=>l.a.lon!=null&&l.a.lat!=null&&l.b.lon!=null&&l.b.lat!=null), 'a/b carry lon/lat');
ok(!links.some(l=>l.a.name==='No Loc'||l.b.name==='No Loc'||l.a.name==='No ID'||l.b.name==='No ID'), 'nodes missing lat/lon/id excluded');
// deduped scheme: a node can appear in >k pairs (incoming from later members),
// but each group's pair count is bounded by members*k
ok(links.filter(l=>(l.a.peer_group||'Other')==='Ivy League').length<=3*2, 'per-group pairs bounded by members*k');
ok(links.length<=2*fixture.length, 'link count bounded by 2N');
ok(JSON.stringify(links)===JSON.stringify(mapPeerLinks(fixture, 2)), 'deterministic across runs');
// score-nearest: a1 (90) links to a2 (88) — its nearest Ivy mate
ok(pairKeys.some(k=>['a1','a2'].every(id=>k.split('|').includes(id))), 'a1 links to its score-nearest mate a2');
// top-12 cap: 19-member group only lets top-12-by-score participate
const big=[];
for(let i=0;i<19;i++) big.push({id:'g'+i, name:'G'+i, score:100-i, peer_group:'Big Ten', lon:-83+i*0.01, lat:42});
const bigLinks=mapPeerLinks(big, 2);
const participants=new Set(); bigLinks.forEach(l=>{participants.add(l.a.id);participants.add(l.b.id);});
const cutIds=new Set(['g12','g13','g14','g15','g16','g17','g18']);
ok([...cutIds].every(id=>!participants.has(id)), 'members ranked 13-19 excluded by top-12 cap');
ok(bigLinks.length===24, '12 members x 2 links each, deduped = 24 pairs');
ok(bigLinks.every(l=>l.str>=0.22&&l.str<=0.46), 'all str in [0.22,0.46]');
ok(bigLinks.every(l=>((l.a.peer_group||'')===(l.b.peer_group||''))), 'cap keeps intra-group links only');
// tie-break by id is deterministic
const ties=[{id:'x2',score:80,peer_group:'T',lon:0,lat:0},{id:'x1',score:80,peer_group:'T',lon:1,lat:1},{id:'x0',score:60,peer_group:'T',lon:2,lat:2}];
const tieLinks=mapPeerLinks(ties, 1);
ok(JSON.stringify(tieLinks)===JSON.stringify(mapPeerLinks(ties, 1)), 'tie case deterministic');

// --- escMapLink ---
ok(escMapLink('Texas A&M')==='Texas A&amp;M', 'escapes &');
ok(escMapLink('<script>x</script>')==='&lt;script&gt;x&lt;/script&gt;', 'neutralizes script tags');
ok(escMapLink(null)==='', 'null -> empty string');

// --- mapPeerLinkTip ---
const A={name:'Texas A&M', score:85, peer_group:'SEC'};
const B={name:'Bama', score:82, peer_group:'SEC'};
let t=mapPeerLinkTip(A,B,0.42);
ok(t.includes('<b>Texas A&amp;M</b> &#8596; <b>Bama</b>'), 'tip names joined with arrow, escaped');
ok(t.includes('Peer-group link: SEC'), 'tip peer_group line');
ok(t.includes('Scores 85.0 / 82.0 (&#916;3.0)'), 'tip score Delta');
ok(t.includes('Link strength 0.420'), 'tip strength toFixed(3)');
ok(mapPeerLinkTip(A,B,0.42)===t, 'tip deterministic');
ok(mapPeerLinkTip({name:'X'},{name:'Y'},null).includes('Link strength n/a'), 'null str -> n/a');
ok(mapPeerLinkTip({name:'X',peer_group:'P'},{name:'Y'},null).includes('Peer-group link: P'), 'group falls back to a.peer_group');
ok(mapPeerLinkTip({name:'X',score:null},{name:'Y'},null).includes('Scores ? / ?'), 'missing scores -> ? with no Delta');
ok(!mapPeerLinkTip({name:'<script>alert(1)</script>',score:80,peer_group:'P&G'},{name:'Y',score:79,peer_group:'P&G'},0.4).includes('<script>'), 'no raw script leak');

// --- real-universe smoke ---
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','universities.json'),'utf8'));
const real=mapPeerLinks(data.universities, 2);
ok(real.length>0 && real.length<=data.universities.length*2, 'real-universe link count sane: '+real.length);
ok(real.every(l=>((l.a.peer_group||'Other')===(l.b.peer_group||'Other'))), 'real-universe: all links intra-peer_group');
ok(real.every(l=>l.str>=0.22&&l.str<=0.46), 'real-universe: all str in [0.22,0.46]');
const rpk=real.map(l=>[l.a.id,l.b.id].sort().join('|'));
ok(new Set(rpk).size===rpk.length, 'real-universe: no duplicate pairs');
ok(real.every(l=>l.a.lon!=null&&l.a.lat!=null&&l.b.lon!=null&&l.b.lat!=null), 'real-universe: all endpoints have lon/lat');
// Big Ten has 19 members -> top-12 cap must apply
const bigTenLinks=real.filter(l=>(l.a.peer_group||'')==='Big Ten');
const bigTenIds=new Set(); bigTenLinks.forEach(l=>{bigTenIds.add(l.a.id);bigTenIds.add(l.b.id);});
ok(bigTenIds.size<=12, 'real-universe: Big Ten participation capped at 12, got '+bigTenIds.size);
// visual width encoding sanity
const widths=real.map(l=>(0.6+l.str*1.6).toFixed(2));
ok(widths.every(w=>+w>=0.9&&+w<=1.4), 'real-universe: stroke widths in [0.95,1.34]');

console.log('MAP-PEERLINK-V30: '+pass+' pass, '+fail+' fail');
process.exit(fail?1:0);
