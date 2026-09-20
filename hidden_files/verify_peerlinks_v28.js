// verify_peerlinks_v28.js — unit test for the PEER-LINK-V28 block in js/app.js.
// The block is mechanically extracted between PEER-LINK-V28-BEGIN/END markers
// (no transcription); run with `new Function` scope.
// Usage: node hidden_files/verify_peerlinks_v28.js

const fs=require('fs'), path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','js','app.js'),'utf8');
const m=src.match(/\/\/ PEER-LINK-V28-BEGIN\n([\s\S]*?)\/\/ PEER-LINK-V28-END/);
if(!m){ console.error('FAIL: markers not found'); process.exit(1); }
const scope=new Function(m[1]+'; return {peerLinkProps, buildPeerLinks};');
const {peerLinkProps, buildPeerLinks}=scope();

let pass=0, fail=0;
function ok(cond, label){ if(cond){pass++;} else {fail++; console.error('FAIL:',label);} }

// --- peerLinkProps ---
const A={id:'a',score:80,peer_group:'Ivy League'};
const B={id:'b',score:80,peer_group:'Ivy League'};
const C={id:'c',score:80,peer_group:'Big Ten'};
const D={id:'d',score:50,peer_group:'Ivy League'};

let p=peerLinkProps(A,B);
ok(p.dist===20 && p.str===0.46, 'identical score + same pg -> dist 20, str 0.46 (got '+p.dist+','+p.str+')');
p=peerLinkProps(A,C);
ok(p.dist===28 && p.str===0.38, 'identical score + different pg -> dist 28, str 0.38 (got '+p.dist+','+p.str+')');
p=peerLinkProps(A,D);
ok(p.dist===62 && p.str===0.22, 'gap 30 + same pg -> dist 62, str 0.22 (got '+p.dist+','+p.str+')');
// monotonicity in gap
const g0=peerLinkProps(A,B), g10=peerLinkProps(A,{...B,score:90}), g30=peerLinkProps(A,{...B,score:110});
ok(g0.dist<g10.dist && g10.dist<g30.dist, 'dist increases with score gap');
ok(g0.str>g10.str && g10.str>g30.str, 'str decreases with score gap');
// saturation caps
const far=peerLinkProps(A,{...B,score:0,peer_group:'X'});
ok(far.dist===80 && far.str===0.14, 'large gap + diff pg saturates at dist 80, str 0.14 (got '+far.dist+','+far.str+')');
// missing peer_group -> no bonus, no throw
const noPg=peerLinkProps({id:'x',score:70},{id:'y',score:70});
ok(noPg.dist===28 && noPg.str===0.38, 'missing peer_group treated as different, no throw');
// bounds across a sweep
for(let i=0;i<=50;i+=5){
  const q=peerLinkProps({id:'p',score:70,peer_group:'G'},{id:'q',score:70+i,peer_group:i%2?'H':'G'});
  ok(q.dist>=20 && q.dist<=80 && q.str>=0.14 && q.str<=0.5, 'bounds hold at gap '+i+' (dist '+q.dist+', str '+q.str+')');
}

// --- buildPeerLinks ---
function mkNodes(arr){ return arr.map(x=>({id:x[0], score:x[1], group:x[2], peer_group:x[3]})); }
// score-nearest selection: a(80) nearest are b(82), then d(85), not c(60)
let nodes=mkNodes([['a',80,'G1','PG'],['b',82,'G1','PG'],['c',60,'G1','PG'],['d',85,'G1','PG'],['e',95,'G2','PG2']]);
let links=buildPeerLinks(nodes,2);
const tgt=id=>links.filter(l=>l.source===id).map(l=>l.target).sort();
ok(JSON.stringify(tgt('a'))===JSON.stringify(['b','d']), 'a links to score-nearest b,d (got '+JSON.stringify(tgt('a'))+')');
ok(!links.some(l=>l.source===l.target), 'no self-links');
ok(!links.some(l=>l.source==='e' || l.target==='e'), 'e isolated: no cross-group links');
const pairKey=l=>[l.source,l.target].sort().join('|');
ok(new Set(links.map(pairKey)).size===links.length, 'no duplicate pairs');
ok(links.every(l=>typeof l.dist==='number' && typeof l.str==='number'), 'every link carries dist+str');
ok(tgt('b').length<=2 && tgt('c').length<=2, 'k=2 cap respected');
// determinism
const links2=buildPeerLinks(nodes,2);
ok(JSON.stringify(links)===JSON.stringify(links2), 'deterministic across runs');
// k=1
const k1=buildPeerLinks(nodes,1);
ok(k1.filter(l=>l.source==='a').length===1 && k1.filter(l=>l.source==='a')[0].target==='b', 'k=1 picks single nearest');
// cap-12: 20-node group -> only top-12 participate
const big=[];
for(let i=0;i<20;i++) big.push(['n'+i, 50+i, 'BIG', 'PG']);
const bigLinks=buildPeerLinks(big.map(x=>({id:x[0],score:x[1],group:x[2],peer_group:x[3]})), 2);
const bigIds=new Set(bigLinks.flatMap(l=>[l.source,l.target]));
ok([...bigIds].every(id=>+id.slice(1)>=8), 'only top-12 by score participate in links (got '+[...bigIds].sort().join(',')+')');
// tie-break by id for determinism
const tie=mkNodes([['a',80,'G','PG'],['b',85,'G','PG'],['c',75,'G','PG']]);
const tieLinks=buildPeerLinks(tie,1);
ok(tieLinks.filter(l=>l.source==='a')[0].target==='b', 'equal-gap tie broken by id (a->b before a->c)');
// xwalk-compat shape: source/target are id strings pre-simulation
ok(links.every(l=>typeof l.source==='string' && typeof l.target==='string'), 'source/target are id strings');

// --- real 200-universe smoke ---
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','universities.json'),'utf8'));
const unis=data.universities.map(u=>({...u, group:u.conference||u.peer_group||'Other'}));
const real=buildPeerLinks(unis,2);
ok(real.length>0, 'real universe produces links ('+real.length+')');
const nodeMap={}; unis.forEach(u=>nodeMap[u.id]=u);
ok(real.every(l=>nodeMap[l.source].group===nodeMap[l.target].group), 'all real links same-group');
ok(new Set(real.map(pairKey)).size===real.length, 'no duplicate pairs on real universe');
ok(real.every(l=>l.source!==l.target), 'no self-links on real universe');
ok(real.every(l=>l.dist>=20 && l.dist<=80 && l.str>=0.14 && l.str<=0.5), 'props in bounds on real universe');
ok(Math.max(...real.map(l=>l.dist))>Math.min(...real.map(l=>l.dist)), 'distance varies across links (weighted, not uniform)');
ok(Math.max(...real.map(l=>l.str))>Math.min(...real.map(l=>l.str)), 'strength varies across links (weighted, not uniform)');

console.log(`peerlinks v28: ${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
