// verify_peercap_v38.js — unit test for the PEER-CAP-V38 adaptive group cap.
// adaptivePeerCap is defined in both the PEER-LINK-V28 block (used by
// buildPeerLinks, inside renderPeers) and the MAP-PEERLINK-V30 block (used by
// mapPeerLinks, module level); both copies are mechanically extracted here and
// must agree exactly. Also exercises the cap through both link builders.
// Usage: node hidden_files/verify_peercap_v38.js

const fs=require('fs'), path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','js','app.js'),'utf8');
const m28=src.match(/\/\/ PEER-LINK-V28-BEGIN\n([\s\S]*?)\/\/ PEER-LINK-V28-END/);
const m30=src.match(/\/\/ MAP-PEERLINK-V30-BEGIN\n([\s\S]*?)\/\/ MAP-PEERLINK-V30-END/);
let pass=0, fail=0;
function ok(cond, label){ if(cond){pass++;} else {fail++; console.error('FAIL:',label);} }

ok(m28 && m30, 'both PEER-LINK-V28 and MAP-PEERLINK-V30 markers found');
if(!m28 || !m30){ console.log(pass+' passed, '+fail+' failed'); process.exit(1); }

const A=new Function(m28[1]+'; return {adaptivePeerCap, buildPeerLinks};')();
const B=new Function(m30[1]+'; return {adaptivePeerCap, mapPeerLinks};')();
const cap=A.adaptivePeerCap, mapCap=B.adaptivePeerCap;

// --- exact values: <=12 unchanged, then max(12, 60% of n) ---
const expected=[[0,0],[1,1],[5,5],[12,12],[13,12],[19,12],[20,12],[21,13],[25,15],[43,26],[67,41],[120,72],[129,78],[139,84]];
expected.forEach(([n,c])=>ok(cap(n)===c, 'cap('+n+') === '+c+' (got '+cap(n)+')'));

// --- both block copies agree on the full sweep ---
ok([...Array(301).keys()].every(n=>cap(n)===mapCap(n)), 'V28 and V30 adaptivePeerCap copies agree 0..300');

// --- edge inputs ---
ok(cap(null)===0 && cap(undefined)===0 && cap(NaN)===0, 'null/undefined/NaN -> 0');
ok(cap(-5)===0, 'negative -> 0');
ok(cap('25')===15, 'string coercion works');

// --- shape: monotonic non-decreasing, never exceeds n ---
ok([...Array(300).keys()].every(n=>cap(n+1)>=cap(n)), 'monotonic non-decreasing 0..300');
ok([...Array(301).keys()].every(n=>cap(n)<=n), 'cap(n) <= n for 0..300');

// --- buildPeerLinks: 30-node group -> cap(30)=18, ranks 13-18 now participate ---
const g30=[]; for(let i=0;i<30;i++) g30.push({id:'g'+i, score:100-i, group:'G', peer_group:'P'});
const L30=A.buildPeerLinks(g30,2);
const part30=new Set(L30.flatMap(l=>[l.source,l.target]));
ok(part30.size===18, '30-node group: exactly 18 participants (got '+part30.size+')');
ok([...Array(12).keys()].every(i=>part30.has('g'+i)), '30-node: top-12 still participate');
ok([12,13,14,15,16,17].every(i=>part30.has('g'+i)), '30-node: ranks 13-18 participate (new vs fixed cap)');
ok([...Array(12).keys()].every(i=>!part30.has('g'+(18+i))), '30-node: ranks 19-30 excluded');
ok(L30.length===36, '30-node: 18 members x 2 links = 36 pairs (got '+L30.length+')');
ok(JSON.stringify(L30)===JSON.stringify(A.buildPeerLinks(g30,2)), 'buildPeerLinks deterministic on 30-node group');

// --- regression: fixed-12 behavior preserved where the old suites pin it ---
const b20=[]; for(let i=0;i<20;i++) b20.push({id:'n'+i, score:50+i, group:'BIG', peer_group:'PG'});
const ids20=new Set(A.buildPeerLinks(b20,2).flatMap(l=>[l.source,l.target]));
ok(ids20.size===12 && [...ids20].every(id=>+id.slice(1)>=8), '20-node group: still top-12 only (v28 pin intact)');
const b19=[]; for(let i=0;i<19;i++) b19.push({id:'n'+i, score:50+i, group:'BIG', peer_group:'PG'});
const ids19=new Set(A.buildPeerLinks(b19,2).flatMap(l=>[l.source,l.target]));
ok(ids19.size===12, '19-node group: still top-12 only (cap(19)=12)');

// --- mapPeerLinks: same cap through the map builder ---
const m30f=[]; for(let i=0;i<30;i++) m30f.push({id:'h'+i, name:'H'+i, score:100-i, peer_group:'P', lon:-80+i*0.01, lat:40});
const ML=B.mapPeerLinks(m30f,2);
const mpart=new Set(); ML.forEach(l=>{mpart.add(l.a.id);mpart.add(l.b.id);});
ok(mpart.size===18, 'map 30-node peer_group: exactly 18 participants (got '+mpart.size+')');
ok([12,13,14,15,16,17].every(i=>mpart.has('h'+i)), 'map 30-node: ranks 13-18 participate (new vs fixed cap)');
ok([...Array(12).keys()].every(i=>!mpart.has('h'+(18+i))), 'map 30-node: ranks 19-30 excluded');
ok(ML.length===36, 'map 30-node: 36 links (got '+ML.length+')');
ok(JSON.stringify(ML)===JSON.stringify(B.mapPeerLinks(m30f,2)), 'mapPeerLinks deterministic on 30-node group');

// --- real-universe: per-mode participant counts reflect the adaptive cap ---
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','universities.json'),'utf8')).universities;
function partCount(mode){
  const nodes=data.map(u=>{
    let g;
    if(mode==='conference') g=u.conference||u.peer_group||'Other';
    else if(mode==='carnegie') g=u.carnegie;
    else if(mode==='control') g=u.control;
    else if(mode==='state') g=u.state;
    else g='All';
    return {...u, group:g};
  });
  const links=A.buildPeerLinks(nodes,2);
  const s=new Set(links.flatMap(l=>[l.source,l.target]));
  return s.size;
}
const carnegie=partCount('carnegie'), control=partCount('control'), state=partCount('state'), conf=partCount('conference');
ok(carnegie>36 && control>24 && state>72, 'real-universe: adaptive cap lifts carnegie='+carnegie+' control='+control+' state='+state+' well above fixed-cap levels (36/24/72)');
ok(conf>=44, 'real-universe conference mode participants sane: '+conf);
// map real-universe
const realMap=B.mapPeerLinks(data,2);
const mreal=new Set(); realMap.forEach(l=>{mreal.add(l.a.id);mreal.add(l.b.id);});
ok(mreal.size>=48, 'real-universe map peer links participants sane: '+mreal.size);

console.log(pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
