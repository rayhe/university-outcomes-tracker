// verify_linkthin_v40.js — unit tests for the MAP-LINKTHIN-V40 block in js/app.js.
// linkDensity/linkKey/thinMapLinks are mechanically extracted between
// MAP-LINKTHIN-V40-BEGIN/END markers (no transcription); mapPeerLinks is
// extracted from the V30 block for the real-data empirical check.
// Usage: node hidden_files/verify_linkthin_v40.js

const fs=require('fs'), path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','js','app.js'),'utf8');
const v40=src.match(/\/\/ MAP-LINKTHIN-V40-BEGIN\n([\s\S]*?)\/\/ MAP-LINKTHIN-V40-END/);
if(!v40){ console.error('FAIL: V40 markers not found'); process.exit(1); }
const v30=src.match(/\/\/ MAP-PEERLINK-V30-BEGIN\n([\s\S]*?)\/\/ MAP-PEERLINK-V30-END/);
if(!v30){ console.error('FAIL: V30 markers not found'); process.exit(1); }
const scope=new Function(v40[1]+'; return {linkDensity,linkKey,thinMapLinks};');
const {linkDensity,linkKey,thinMapLinks}=scope();
const {mapPeerLinks}=new Function(v30[1]+'; return {mapPeerLinks};')();

let pass=0, fail=0;
function ok(cond, label){ if(cond){pass++;} else {fail++; console.error('FAIL:',label);} }

// --- linkDensity ---
ok(JSON.stringify(linkDensity([],26))==='[]', 'LD1: empty in, empty out');
ok(JSON.stringify(linkDensity([{x:0,y:0}],26))==='[0]', 'LD2: single dot -> [0]');
{
  const d=linkDensity([{x:0,y:0},{x:10,y:0}],26);
  ok(d[0]===1&&d[1]===1, 'LD3: pair within r counts each other');
  const d2=linkDensity([{x:0,y:0},{x:100,y:0}],26);
  ok(d2[0]===0&&d2[1]===0, 'LD3: pair outside r counts nobody');
}
{
  const cl=[]; for(let i=0;i<5;i++) cl.push({x:300,y:200});
  ok(linkDensity(cl,26).every(c=>c===4), 'LD4: 5 coincident dots -> 4 neighbors each');
}
{
  const d=linkDensity([{x:0,y:0},{x:1,y:0}],0);
  ok(d[0]===0&&d[1]===0, 'LD5: r=0, distinct points -> 0');
  const d2=linkDensity([{x:0,y:0},{x:0,y:0}],0);
  ok(d2[0]===1&&d2[1]===1, 'LD5: r=0, coincident points still within radius');
}
{
  const before=[{x:0,y:0},{x:5,y:5}];
  linkDensity(before,26);
  ok(before[0].x===0&&before[1].y===5, 'LD6: input not mutated');
}

// --- thinMapLinks fixtures ---
const n=id=>({id:id, name:id, score:80, peer_group:'G', lon:0, lat:0});
function linksOf(pairs){ // pairs: [[aId,bId,str],...]
  const nodes={};
  const get=id=>nodes[id]||(nodes[id]=n(id));
  return pairs.map(p=>({a:get(p[0]), b:get(p[1]), str:p[2]}));
}

// T1: no dense nodes -> identity (same links, original order preserved)
{
  const L=linksOf([['A','B',0.4],['A','C',0.3],['B','C',0.45]]);
  const out=thinMapLinks(L,()=>0);
  ok(out.length===3&&out.every((l,i)=>l===L[i]), 'T1: all-sparse -> links unchanged, order preserved');
}
// T2: dense node keeps only its strongest; a link both endpoints drop is removed
{
  // H dense (keeps 1: H-X .9). X,Y dense with stronger X-Y .95 so X,Y drop their
  // links to H. H-X survives via H; H-Y dropped by both endpoints.
  const nodes={}; const get=id=>nodes[id]||(nodes[id]=n(id));
  const L=[{a:get('H'),b:get('X'),str:0.9},{a:get('H'),b:get('Y'),str:0.8},{a:get('X'),b:get('Y'),str:0.95}];
  const dens=id=>({H:10,X:10,Y:10}[id]);
  const out=thinMapLinks(L,node=>dens(node.id));
  const keys=out.map(linkKey);
  ok(keys.includes('H|X'), 'T2: H-X (H\'s strongest) survives');
  ok(keys.includes('X|Y'), 'T2: X-Y (strongest of X and Y) survives');
  ok(!keys.includes('H|Y'), 'T2: H-Y dropped — neither endpoint kept it');
}
// T3: every participant retains at least one link
{
  const L=linksOf([['A','B',0.4],['B','C',0.35],['C','D',0.5],['D','A',0.3]]);
  const out=thinMapLinks(L,node=>node.id==='B'?8:0);
  const part=new Set(), partOut=new Set();
  L.forEach(l=>{part.add(l.a.id);part.add(l.b.id);});
  out.forEach(l=>{partOut.add(l.a.id);partOut.add(l.b.id);});
  ok([...part].every(id=>partOut.has(id)), 'T3: no linked school goes linkless');
}
// T4: custom opts honored
{
  const L=linksOf([['A','B',0.4],['A','C',0.3]]);
  const dense=id=>10;
  ok(thinMapLinks(L,node=>dense(node.id),{denseAt:100}).length===2, 'T4: denseAt=100 -> no thinning');
  // kSparse=1 on a triangle: A keeps A-B(.4), B and C keep B-C(.45) — A-C(.3)
  // is kept by no endpoint and drops out.
  const tri=linksOf([['A','B',0.4],['A','C',0.3],['B','C',0.45]]);
  const triOut=thinMapLinks(tri,()=>0,{kSparse:1});
  const triKeys=triOut.map(linkKey);
  ok(triKeys.length===2&&triKeys.includes('A|B')&&triKeys.includes('B|C')&&!triKeys.includes('A|C'),
    'T4: kSparse=1 -> weakest unkept link A-C dropped');
}
// T5: determinism across runs
{
  const L=linksOf([['A','B',0.4],['A','C',0.4],['B','C',0.4]]);
  const f=()=>thinMapLinks(L,node=>({A:7,B:0,C:7}[node.id]));
  ok(JSON.stringify(f())===JSON.stringify(f()), 'T5: deterministic (incl. tie-break by linkKey)');
}
// T6: input array not mutated
{
  const L=linksOf([['A','B',0.4],['A','C',0.3],['B','C',0.45]]);
  const snap=JSON.stringify(L);
  thinMapLinks(L,node=>node.id==='A'?9:0);
  ok(JSON.stringify(L)===snap&&L.length===3, 'T6: input links array untouched');
}
// T7: linkKey is order-independent
{
  const L=linksOf([['A','B',0.4]]);
  const rev=[{a:L[0].b,b:L[0].a,str:0.4}];
  ok(linkKey(L[0])===linkKey(rev[0]), 'T7: linkKey ignores endpoint order');
}
// T8: missing density lookup degrades to kSparse (no crash, no drop)
{
  const L=linksOf([['A','B',0.4]]);
  const out=thinMapLinks(L,()=>undefined);
  ok(out.length===1, 'T8: undefined density -> treated as sparse, link kept');
}

// --- real-universe empirical (rough linear projection, same as v0.37/v0.39) ---
{
  const data=require(path.join(__dirname,'..','data','universities.json'));
  const pts=data.universities.filter(u=>u.lat!=null&&u.lon!=null);
  const w=980, h=Math.round(w*0.52);
  let loMin=1e9,loMax=-1e9,laMin=1e9,laMax=-1e9;
  pts.forEach(u=>{loMin=Math.min(loMin,u.lon);loMax=Math.max(loMax,u.lon);laMin=Math.min(laMin,u.lat);laMax=Math.max(laMax,u.lat);});
  const dots=pts.map(u=>({x:(u.lon-loMin)/(loMax-loMin)*w*0.9+w*0.05,
                          y:(1-(u.lat-laMin)/(laMax-laMin))*h*0.9+h*0.05}));
  const dens=linkDensity(dots,26);
  const idx=new Map(); pts.forEach((u,i)=>idx.set(u,i));
  const densOf=d=>dens[idx.get(d)];
  const links=mapPeerLinks(pts,2);
  const thinned=thinMapLinks(links,densOf);
  ok(thinned.length<links.length, 'R1: real-data links thinned ('+links.length+' -> '+thinned.length+')');
  const ddBefore=links.filter(l=>densOf(l.a)>=6&&densOf(l.b)>=6).length;
  const ddAfter=thinned.filter(l=>densOf(l.a)>=6&&densOf(l.b)>=6).length;
  ok(ddAfter<ddBefore, 'R2: dense-dense links reduced ('+ddBefore+' -> '+ddAfter+')');
  const part=new Set(), partT=new Set();
  links.forEach(l=>{part.add(l.a.id);part.add(l.b.id);});
  thinned.forEach(l=>{partT.add(l.a.id);partT.add(l.b.id);});
  ok(partT.size===part.size, 'R3: participant coverage unchanged ('+part.size+' schools)');
  ok(JSON.stringify(thinned)===JSON.stringify(thinMapLinks(links,densOf)), 'R4: real-data result deterministic');
  ok(thinned.every(l=>links.indexOf(l)>=0), 'R5: thinned set is a strict subset of the original links');
}

console.log('LINKTHIN-V40: '+pass+' pass, '+fail+' fail');
process.exit(fail?1:0);
