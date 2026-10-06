// v0.44 peer-normalized resource-efficiency verification. Mechanically
// extracts the EFFICIENCY-V43 block (dependency: efficiencyResiduals) and the
// EFFICIENCY-PEER-V44 block from js/app.js (no transcription) and unit-tests
// the pure peerEfficiency / peerEfficiencyLeaders helpers.
const fs=require('fs');
const src=fs.readFileSync('/home/hatch/repos/university-outcomes-tracker/js/app.js','utf8');
function extract(start,end){
  const a=src.indexOf(start), b=src.indexOf(end);
  if(a<0||b<0) throw new Error('markers not found: '+start);
  return src.slice(a,b);
}
const block=extract('// EFFICIENCY-V43-START','// EFFICIENCY-V43-END')+'\n'
          +extract('// EFFICIENCY-PEER-V44-START','// EFFICIENCY-PEER-V44-END');
const factory=new Function(block+'; return {efficiencyModel,efficiencyResiduals,efficiencyLeaders,peerEfficiency,peerEfficiencyLeaders};');
const {efficiencyModel,efficiencyResiduals,efficiencyLeaders,peerEfficiency,peerEfficiencyLeaders}=factory();

let pass=0,fail=0;
function ok(name,cond){ if(cond){pass++;}else{fail++;console.log('FAIL:',name);} }
const approx=(x,y,t)=>Math.abs(x-y)<=(t==null?1e-9:t);

// synthetic schools: endowment_per_student = e^lx so log() = lx exactly
const U=(id,lx,earn,conf)=>({id,name:'U'+id,median_earn_10yr:earn,endowment_per_student:Math.exp(lx),conference:conf});

// 1. degenerate inputs -> [] and empty leaders
ok('null -> []',peerEfficiency(null).length===0);
ok('empty -> []',peerEfficiency([]).length===0);
ok('single usable -> []',peerEfficiency([U('a',1,50000,'A')]).length===0);
ok('leaders empty',peerEfficiencyLeaders([],3).over.length===0&&peerEfficiencyLeaders(null,3).under.length===0);

// 2. conference with 1 usable school -> peerResid null, confN=1, sorts last
const lone=[U('a',1,10000,'A'),U('b',2,20000,'A'),U('solo',1,15000,'Z')];
const pl=peerEfficiency(lone);
ok('3 rows',pl.length===3);
const solo=pl.find(d=>d.u.id==='solo');
ok('solo peerResid null',solo.peerResid===null&&solo.confN===1&&solo.confMean===null);
ok('solo sorts last',pl[pl.length-1].u.id==='solo');

// 3. peerResid = resid - conference mean; per-conference means sum to ~0
const two=[U('a',1,10000,'A'),U('b',2,20000,'A'),U('c',3,30000,'A'),
           U('x',1,10000,'B'),U('y',2,20000,'B'),U('z',3,30000,'B')];
const pt=peerEfficiency(two);
const aRes=efficiencyResiduals(two).filter(d=>d.u.conference==='A');
const aMean=aRes.reduce((s,d)=>s+d.resid,0)/aRes.length;
const aRows=pt.filter(d=>d.conf==='A');
ok('confMean matches',approx(aRows[0].confMean,aMean));
ok('confN=3',aRows.every(d=>d.confN===3));
ok('peerResid = resid-mean',aRows.every(d=>approx(d.peerResid,d.resid-aMean)));
ok('per-conference peerResid sums ~0',Math.abs(aRows.reduce((s,d)=>s+d.peerResid,0))<1e-6);

// 4. mixed-residual case: global over-converter that is average among peers
// conf A: all exactly on the global line -> resid ~0, peerResid ~0
// conf B: same line but one school above its own peers' line
const mix=[U('a1',1,10000,'A'),U('a2',2,20000,'A'),U('a3',3,30000,'A'),
           U('b1',1,12000,'B'),U('b2',2,22000,'B'),U('b3',3,26000,'B')];
const pm=peerEfficiency(mix);
const b2=pm.find(d=>d.u.id==='b2');
ok('b2 above its peers -> positive peerResid',b2.peerResid>0);
const b3=pm.find(d=>d.u.id==='b3');
ok('b3 below its peers -> negative peerResid',b3.peerResid<0);
const a1=pm.find(d=>d.u.id==='a1');
ok('a rows centered ~0 (within-conf mean)',Math.abs(pm.filter(d=>d.conf==='A').reduce((s,d)=>s+d.peerResid,0))<1e-6);

// 5. missing-conference records group under 'Other'
const noc=[U('m1',1,10000),U('m2',2,20000)];
const pn=peerEfficiency(noc);
ok('missing conf -> Other',pn.every(d=>d.conf==='Other'));
ok('Other confN=2',pn.every(d=>d.confN===2));

// 6. leaders: k default 3, clamping, over/under discipline, sort order
const L=peerEfficiencyLeaders(mix,2);
ok('leaders k=2',L.over.length<=2&&L.under.length<=2);
ok('over all positive',L.over.every(d=>d.peerResid>0));
ok('under all negative',L.under.every(d=>d.peerResid<0));
ok('over desc order',L.over.every((d,i)=>i===0||L.over[i-1].peerResid>=d.peerResid));
ok('under most-negative first',L.under.every((d,i)=>i===0||L.under[i-1].peerResid<=d.peerResid));
const Lk0=peerEfficiencyLeaders(mix,0);
ok('k=0 clamps to 1',Lk0.over.length<=1&&Lk0.under.length<=1);
const LkD=peerEfficiencyLeaders(mix);
ok('default k=3',LkD.over.length<=3&&LkD.under.length<=3);

// 7. deterministic: same input twice -> identical id order
const r1=peerEfficiency(mix).map(d=>d.u.id).join(','), r2=peerEfficiency(mix).map(d=>d.u.id).join(',');
ok('deterministic',r1===r2);

// 8. input never mutated
const froze=[U('f1',1,10000,'A'),U('f2',2,20000,'A')];
const before=JSON.stringify(froze);
peerEfficiency(froze); peerEfficiencyLeaders(froze,2);
ok('input not mutated',JSON.stringify(froze)===before);

// 9. real universe: 249 rows, 240 peer-normalizable (9 lone conferences),
// 40 conferences, desc order, top/bottom named sanity
const data=JSON.parse(fs.readFileSync('/home/hatch/repos/university-outcomes-tracker/data/universities.json','utf8'));
const real=peerEfficiency(data.universities);
ok('real 249 rows',real.length===249);
const norm=real.filter(d=>d.peerResid!=null);
ok('real 240 normalized',norm.length===240);
ok('real confs = total - 9 lone',new Set(norm.map(d=>d.conf)).size===new Set(real.map(d=>d.conf)).size-9);
ok('real desc order',real.slice(0,240).every((d,i,arr)=>i===0||arr[i-1].peerResid>=d.peerResid));
const rl=peerEfficiencyLeaders(data.universities,3);
ok('real leaders over x3',rl.over.length===3&&rl.under.length===3);
console.log('TOP-OVER:',rl.over.map(d=>d.u.name+' +$'+(d.peerResid/1000).toFixed(1)+'k vs '+d.conf).join(' | '));
console.log('TOP-UNDER:',rl.under.map(d=>d.u.name+' $'+(d.peerResid/1000).toFixed(1)+'k vs '+d.conf).join(' | '));

console.log(`\npeer_efficiency_v44: ${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
