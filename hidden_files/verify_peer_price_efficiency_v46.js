// v0.46 peer-normalized price-efficiency verification. Mechanically
// extracts the PRICE-EFFICIENCY-V45 block (dependency: priceEfficiencyResiduals)
// and the EFFICIENCY-PEER-PRICE-V46 block from js/app.js (no transcription)
// and unit-tests the pure peerPriceEfficiency / peerPriceEfficiencyLeaders
// helpers.
const fs=require('fs');
const src=fs.readFileSync('/home/hatch/repos/university-outcomes-tracker/js/app.js','utf8');
function extract(start,end){
  const a=src.indexOf(start), b=src.indexOf(end);
  if(a<0||b<0) throw new Error('markers not found: '+start);
  return src.slice(a,b);
}
const block=extract('// PRICE-EFFICIENCY-V45-START','// PRICE-EFFICIENCY-V45-END')+'\n'
          +extract('// EFFICIENCY-PEER-PRICE-V46-START','// EFFICIENCY-PEER-PRICE-V46-END');
const factory=new Function(block+'; return {priceEfficiencyModel,priceEfficiencyResiduals,priceEfficiencyLeaders,peerPriceEfficiency,peerPriceEfficiencyLeaders};');
const {priceEfficiencyModel,priceEfficiencyResiduals,priceEfficiencyLeaders,peerPriceEfficiency,peerPriceEfficiencyLeaders}=factory();

let pass=0,fail=0;
function ok(name,cond){ if(cond){pass++;}else{fail++;console.log('FAIL:',name);} }
const approx=(x,y,t)=>Math.abs(x-y)<=(t==null?1e-9:t);

// synthetic schools: linear in (price,earn)
const U=(id,price,earn,conf)=>({id,name:'U'+id,median_earn_10yr:earn,net_price_avg:price,conference:conf});

// 1. degenerate inputs -> [] and empty leaders
ok('null -> []',peerPriceEfficiency(null).length===0);
ok('empty -> []',peerPriceEfficiency([]).length===0);
ok('single usable -> []',peerPriceEfficiency([U('a',10000,50000,'A')]).length===0);
ok('no usable prices -> []',peerPriceEfficiency([U('a',0,50000,'A'),U('b',-1,60000,'A')]).length===0);
ok('leaders empty',peerPriceEfficiencyLeaders([],3).over.length===0&&peerPriceEfficiencyLeaders(null,3).under.length===0);

// 2. conference with 1 usable school -> peerResid null, confN=1, confMean null,
// sorts last
const lone=[U('a',10000,50000,'A'),U('b',20000,60000,'A'),U('solo',15000,55000,'Z')];
const pl=peerPriceEfficiency(lone);
ok('3 rows',pl.length===3);
const solo=pl.find(d=>d.u.id==='solo');
ok('solo peerResid null',solo.peerResid===null&&solo.confN===1&&solo.confMean===null);
ok('solo sorts last',pl[pl.length-1].u.id==='solo');

// 3. peerResid = resid - conference mean; per-conference peerResids sum ~0
const two=[U('a',10000,50000,'A'),U('b',20000,60000,'A'),U('c',30000,70000,'A'),
           U('x',10000,52000,'B'),U('y',20000,64000,'B'),U('z',30000,76000,'B')];
const pt=peerPriceEfficiency(two);
const aRes=priceEfficiencyResiduals(two).filter(d=>d.u.conference==='A');
const aMean=aRes.reduce((s,d)=>s+d.resid,0)/aRes.length;
const aRows=pt.filter(d=>d.conf==='A');
ok('confMean matches',approx(aRows[0].confMean,aMean));
ok('confN=3',aRows.every(d=>d.confN===3));
ok('peerResid = resid-mean',aRows.every(d=>approx(d.peerResid,d.resid-aMean)));
ok('per-conference peerResid sums ~0',Math.abs(aRows.reduce((s,d)=>s+d.peerResid,0))<1e-6);

// 4. mixed-residual case: school b2 above its own peers' price line
const mix=[U('a1',10000,50000,'A'),U('a2',20000,60000,'A'),U('a3',30000,70000,'A'),
           U('b1',10000,52000,'B'),U('b2',20000,70000,'B'),U('b3',30000,74000,'B')];
const pm=peerPriceEfficiency(mix);
const b2=pm.find(d=>d.u.id==='b2');
ok('b2 above its peers -> positive peerResid',b2.peerResid>0);
const b3=pm.find(d=>d.u.id==='b3');
ok('b3 below its peers -> negative peerResid',b3.peerResid<0);
ok('A rows centered ~0 (within-conf mean)',Math.abs(pm.filter(d=>d.conf==='A').reduce((s,d)=>s+d.peerResid,0))<1e-6);

// 5. missing-conference records group under 'Other'
const noc=[U('m1',10000,50000),U('m2',20000,60000)];
const pn=peerPriceEfficiency(noc);
ok('missing conf -> Other',pn.every(d=>d.conf==='Other'));
ok('Other confN=2',pn.every(d=>d.confN===2));

// 6. leaders: k default 3, clamping, over/under discipline, sort order
const L=peerPriceEfficiencyLeaders(mix,2);
ok('leaders k=2',L.over.length<=2&&L.under.length<=2);
ok('over all positive',L.over.every(d=>d.peerResid>0));
ok('under all negative',L.under.every(d=>d.peerResid<0));
ok('over desc order',L.over.every((d,i)=>i===0||L.over[i-1].peerResid>=d.peerResid));
ok('under most-negative first',L.under.every((d,i)=>i===0||L.under[i-1].peerResid<=d.peerResid));
const Lk0=peerPriceEfficiencyLeaders(mix,0);
ok('k=0 clamps to 1',Lk0.over.length<=1&&Lk0.under.length<=1);
const LkD=peerPriceEfficiencyLeaders(mix);
ok('default k=3',LkD.over.length<=3&&LkD.under.length<=3);

// 7. deterministic: same input twice -> identical id order
const r1=peerPriceEfficiency(mix).map(d=>d.u.id).join(','), r2=peerPriceEfficiency(mix).map(d=>d.u.id).join(',');
ok('deterministic',r1===r2);

// 8. input never mutated
const froze=[U('f1',10000,50000,'A'),U('f2',20000,60000,'A')];
const before=JSON.stringify(froze);
peerPriceEfficiency(froze); peerPriceEfficiencyLeaders(froze,2);
ok('input not mutated',JSON.stringify(froze)===before);

// 9. determinism across tie: identical (price,earn) schools tie-break by id
const tie=[U('z9',10000,50000,'A'),U('a1',10000,50000,'A'),U('m5',10000,50000,'A'),
           U('q1',20000,70000,'A')];
const pt2=peerPriceEfficiency(tie);
const tied=pt2.filter(d=>approx(d.peerResid,pt2[0].peerResid));
ok('tie-break by id',tied.map(d=>d.u.id).join(',')===[...tied.map(d=>d.u.id)].sort().join(','));

// 10. real universe: 249 rows, 240 peer-normalizable (9 lone conferences),
// 36 conferences, desc order, leader counts
const data=JSON.parse(fs.readFileSync('/home/hatch/repos/university-outcomes-tracker/data/universities.json','utf8'));
const real=peerPriceEfficiency(data.universities);
ok('real 249 rows',real.length===249);
const norm=real.filter(d=>d.peerResid!=null);
ok('real 240 normalized',norm.length===240);
ok('real 36 conferences normalized',new Set(norm.map(d=>d.conf)).size===36);
ok('real desc order',real.slice(0,240).every((d,i,arr)=>i===0||arr[i-1].peerResid>=d.peerResid));
const rl=peerPriceEfficiencyLeaders(data.universities,3);
ok('real leaders over x3',rl.over.length===3&&rl.under.length===3);
ok('real model n=249',priceEfficiencyModel(data.universities).n===249);
console.log('TOP-OVER:',rl.over.map(d=>d.u.name+' +$'+(d.peerResid/1000).toFixed(1)+'k vs '+d.conf).join(' | '));
console.log('TOP-UNDER:',rl.under.map(d=>d.u.name+' $'+(d.peerResid/1000).toFixed(1)+'k vs '+d.conf).join(' | '));

console.log(`\npeer_price_efficiency_v46: ${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
