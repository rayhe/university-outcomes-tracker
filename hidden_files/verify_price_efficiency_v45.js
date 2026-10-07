// v0.45 price-efficiency residual verification. Mechanically extracts the
// PRICE-EFFICIENCY-V45 block from js/app.js (no transcription) and unit-tests
// the pure helpers. The block is self-contained (own OLS + Pearson), so the
// standard marker-extraction pattern works unchanged.
const fs=require('fs');
const src=fs.readFileSync('/home/hatch/repos/university-outcomes-tracker/js/app.js','utf8');
const a=src.indexOf('// PRICE-EFFICIENCY-V45-START'), b=src.indexOf('// PRICE-EFFICIENCY-V45-END');
if(a<0||b<0) throw new Error('PRICE-EFFICIENCY-V45 markers not found');
let block=src.slice(a,b);
const factory=new Function(block+'; return {priceEfficiencyModel,priceEfficiencyResiduals,priceEfficiencyLeaders};');
const {priceEfficiencyModel,priceEfficiencyResiduals,priceEfficiencyLeaders}=factory();

let pass=0,fail=0;
function ok(name,cond){ if(cond){pass++;}else{fail++;console.log('FAIL:',name);} }
const approx=(x,y,t)=>Math.abs(x-y)<=(t==null?1e-9:t);

// synthetic schools with linear price/earn
const P=(id,price,earn)=>({id,name:'P'+id,median_earn_10yr:earn,net_price_avg:price,conference:'Test',control:'public'});

// 1. degenerate inputs -> null model, empty residuals/leaders
ok('null unis -> null',priceEfficiencyModel(null)===null);
ok('empty -> null',priceEfficiencyModel([])===null);
ok('single -> null',priceEfficiencyModel([P('a',10000,50000)])===null);
ok('empty residuals',priceEfficiencyResiduals([]).length===0);
ok('leaders empty',priceEfficiencyLeaders([],'x').over.length===0&&priceEfficiencyLeaders([],3).under.length===0);

// 2. records with missing/zero price or missing earnings are excluded
const mixed=[P('a',10000,50000),{id:'b',median_earn_10yr:60000},P('c',20000,null),P('d',30000,0),{id:'e',median_earn_10yr:70000,net_price_avg:0}];
const mm=priceEfficiencyModel(mixed);
ok('usable n=2 (a kept, d with earn=0 kept, b/c/e excluded)',mm!==null&&mm.n===2);

// 3. exact OLS on a perfect line: price=[10k,20k,30k], earn=2*price -> m=2, b=0, r=1
const line=[P('l1',10000,20000),P('l2',20000,40000),P('l3',30000,60000)];
const lm=priceEfficiencyModel(line);
ok('line m=2',approx(lm.m,2));
ok('line b=0',approx(lm.b,0));
ok('line r=1',approx(lm.r,1));
ok('line n=3',lm.n===3);

// 4. residuals ~0 on the line; sum of residuals ~0 (OLS property)
const lr=priceEfficiencyResiduals(line);
ok('on-line residuals ~0',lr.every(d=>Math.abs(d.resid)<1e-6));
ok('residual sum ~0',Math.abs(lr.reduce((s,d)=>s+d.resid,0))<1e-6);

// 5. a school above the line gets a positive residual, below -> negative
const off=[P('l1',10000,20000),P('l2',20000,40000),P('l3',30000,60000),P('hi',20000,45000),P('lo',20000,35000)];
const offR=priceEfficiencyResiduals(off);
const hi=offR.find(d=>d.u.id==='hi'), lo=offR.find(d=>d.u.id==='lo');
ok('above-line positive',hi.resid>0);
ok('below-line negative',lo.resid<0);
ok('hi ranked before lo',offR.indexOf(hi)<offR.indexOf(lo));

// 6. sorted desc; deterministic tie-break by id
ok('sorted desc',offR.every((d,i)=>i===0||offR[i-1].resid>=d.resid));
const tieA=P('a',10000,20000), tieB=P('b',10000,20000);
const tieR=priceEfficiencyResiduals([tieB,tieA,line[2]]); // input order shuffled
const tied=tieR.filter(d=>d.u.id==='a'||d.u.id==='b');
ok('tie-break by id',tied[0].u.id==='a'&&tied[1].u.id==='b');
const again=priceEfficiencyResiduals([tieB,tieA,line[2]]);
ok('deterministic',JSON.stringify(tieR.map(d=>d.u.id))===JSON.stringify(again.map(d=>d.u.id)));

// 7. input immutability
const snap=JSON.stringify(off);
priceEfficiencyResiduals(off); priceEfficiencyLeaders(off,2);
ok('input not mutated',JSON.stringify(off)===snap);

// 8. leaders: default k=3, clamping, ordering, sign discipline
const L=priceEfficiencyLeaders(off); // hi>0 only over; lo<0 only under
ok('default k=3',L.over.length===1&&L.under.length===1);
ok('over is hi',L.over[0].u.id==='hi');
ok('under most-negative first',L.under[0].u.id==='lo');
const big=[P('p1',10000,50000),P('p2',10000,40000),P('p3',10000,30000),P('q1',10000,5000),P('q2',10000,6000),P('base',10000,20000),P('base2',10000,20000)];
const LB=priceEfficiencyLeaders(big,2);
ok('k=2 caps',LB.over.length===2&&LB.under.length===2);
ok('over desc order',LB.over[0].resid>=LB.over[1].resid);
ok('under asc order (most negative first)',LB.under[0].resid<=LB.under[1].resid);
ok('k=0 clamps to 1',priceEfficiencyLeaders(big,0).over.length===1);
ok('k huge -> all (over=3, under=4: zero-dx fit makes both bases negative)',priceEfficiencyLeaders(big,99).over.length===3&&priceEfficiencyLeaders(big,99).under.length===4);
ok('null k -> 3',priceEfficiencyLeaders(big,null).over.length===3);

// 9. pred field consistency: pred + resid == actual
ok('pred+resid==earn',offR.every(d=>approx(d.pred+d.resid,d.u.median_earn_10yr,1e-6)));

// 10. empirical on the REAL universe: 249 usable, sane model, sorted
const data=JSON.parse(fs.readFileSync('/home/hatch/repos/university-outcomes-tracker/data/universities.json','utf8'));
const real=data.universities;
const rmodel=priceEfficiencyModel(real);
ok('real n=249',rmodel!==null&&rmodel.n===249);
ok('real r in (0.3,0.4) (weak price gradient)',rmodel.r>0.3&&rmodel.r<0.4);
ok('real m>0 (higher price -> higher earnings on average)',rmodel.m>0);
const rr=priceEfficiencyResiduals(real);
ok('real residuals sorted desc',rr.every((d,i)=>i===0||rr[i-1].resid>=d.resid));
ok('real top residual positive',rr[0].resid>0);
ok('real bottom residual negative',rr[rr.length-1].resid<0);
ok('real residual sum ~0',Math.abs(rr.reduce((s,d)=>s+d.resid,0))<1e-3);
const rlead=priceEfficiencyLeaders(real,3);
ok('real leaders 3/3',rlead.over.length===3&&rlead.under.length===3);
ok('real over all positive',rlead.over.every(d=>d.resid>0));
ok('real under all negative',rlead.under.every(d=>d.resid<0));
console.log('real top price over-deliverer:',rr[0].u.name,'+$'+(rr[0].resid/1000).toFixed(1)+'k');
console.log('real worst price under-deliverer:',rr[rr.length-1].u.name,'$'+(rr[rr.length-1].resid/1000).toFixed(1)+'k');
console.log(`price efficiency v45: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
