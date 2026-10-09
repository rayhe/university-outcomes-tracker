// v0.47 selectivity-efficiency residual verification. Mechanically extracts the
// SELECTIVITY-EFFICIENCY-V47 block from js/app.js (no transcription) and
// unit-tests the pure helpers. The block is self-contained (own OLS +
// Pearson), so the standard marker-extraction pattern works unchanged.
const fs=require('fs');
const src=fs.readFileSync('/home/hatch/repos/university-outcomes-tracker/js/app.js','utf8');
const a=src.indexOf('// SELECTIVITY-EFFICIENCY-V47-START'), b=src.indexOf('// SELECTIVITY-EFFICIENCY-V47-END');
if(a<0||b<0) throw new Error('SELECTIVITY-EFFICIENCY-V47 markers not found');
let block=src.slice(a,b);
const factory=new Function(block+'; return {selectivityEfficiencyModel,selectivityEfficiencyResiduals,selectivityEfficiencyLeaders};');
const {selectivityEfficiencyModel,selectivityEfficiencyResiduals,selectivityEfficiencyLeaders}=factory();

let pass=0,fail=0;
function ok(name,cond){ if(cond){pass++;}else{fail++;console.log('FAIL:',name);} }
const approx=(x,y,t)=>Math.abs(x-y)<=(t==null?1e-9:t);

// synthetic schools with log-selectivity/earn relationship
const S=(id,rate,earn)=>({id,name:'S'+id,median_earn_10yr:earn,admission_rate:rate,conference:'Test',control:'public'});

// 1. degenerate inputs -> null model, empty residuals/leaders
ok('null unis -> null',selectivityEfficiencyModel(null)===null);
ok('empty -> null',selectivityEfficiencyModel([])===null);
ok('single -> null',selectivityEfficiencyModel([S('a',0.1,50000)])===null);
ok('empty residuals',selectivityEfficiencyResiduals([]).length===0);
ok('leaders empty',selectivityEfficiencyLeaders([],'x').over.length===0&&selectivityEfficiencyLeaders([],3).under.length===0);

// 2. records with missing/zero admission_rate or missing earnings are excluded;
//    earn=0 is a real number and stays
const mixed=[S('a',0.1,50000),{id:'b',median_earn_10yr:60000},S('c',0.2,null),S('d',0.3,0),{id:'e',median_earn_10yr:70000,admission_rate:0}];
const mm=selectivityEfficiencyModel(mixed);
ok('usable n=2 (a kept, d with earn=0 kept, b/c/e excluded)',mm!==null&&mm.n===2);

// 3. exact OLS on a perfect log line: rates 0.01/0.1/1.0 -> log10 = -2/-1/0,
//    earn = -20000*log10(rate)+50000 -> m=-20000, b=50000, r=-1
const line=[S('l1',0.01,90000),S('l2',0.1,70000),S('l3',1.0,50000)];
const lm=selectivityEfficiencyModel(line);
ok('line m=-20000',approx(lm.m,-20000));
ok('line b=50000',approx(lm.b,50000));
ok('line r=-1',approx(lm.r,-1));
ok('line n=3',lm.n===3);

// 4. residuals ~0 on the line; sum of residuals ~0 (OLS property)
const lr=selectivityEfficiencyResiduals(line);
ok('on-line residuals ~0',lr.every(d=>Math.abs(d.resid)<1e-6));
ok('residual sum ~0',Math.abs(lr.reduce((s,d)=>s+d.resid,0))<1e-6);

// 5. a school above the line gets a positive residual, below -> negative.
//    Points: (-2,90000),(-1,70000),(0,50000),(-1,75000 hi),(-1,65000 lo).
//    Mean x=-1, mean y=70000 -> fit is still m=-20000,b=50000, pred(-1)=70000.
const off=[S('l1',0.01,90000),S('l2',0.1,70000),S('l3',1.0,50000),S('hi',0.1,75000),S('lo',0.1,65000)];
const offR=selectivityEfficiencyResiduals(off);
const hi=offR.find(d=>d.u.id==='hi'), lo=offR.find(d=>d.u.id==='lo');
ok('above-line positive',hi.resid>0);
ok('below-line negative',lo.resid<0);
ok('hi ranked before lo',offR.indexOf(hi)<offR.indexOf(lo));

// 6. sorted desc; deterministic tie-break by id
ok('sorted desc',offR.every((d,i)=>i===0||offR[i-1].resid>=d.resid));
const tieA=S('a',0.1,70000), tieB=S('b',0.1,70000);
const tieR=selectivityEfficiencyResiduals([tieB,tieA,line[2]]); // input order shuffled
const tied=tieR.filter(d=>d.u.id==='a'||d.u.id==='b');
ok('tie-break by id',tied[0].u.id==='a'&&tied[1].u.id==='b');
const again=selectivityEfficiencyResiduals([tieB,tieA,line[2]]);
ok('deterministic',JSON.stringify(tieR.map(d=>d.u.id))===JSON.stringify(again.map(d=>d.u.id)));

// 7. input immutability
const snap=JSON.stringify(off);
selectivityEfficiencyResiduals(off); selectivityEfficiencyLeaders(off,2);
ok('input not mutated',JSON.stringify(off)===snap);

// 8. leaders: default k=3, clamping, ordering, sign discipline
const L=selectivityEfficiencyLeaders(off); // hi>0 only over; lo<0 only under
ok('default k=3',L.over.length===1&&L.under.length===1);
ok('over is hi',L.over[0].u.id==='hi');
ok('under most-negative first',L.under[0].u.id==='lo');
const allR=selectivityEfficiencyResiduals(off);
const npos=allR.filter(d=>d.resid>0).length, nneg=allR.filter(d=>d.resid<0).length;
const LK=selectivityEfficiencyLeaders(off,99);
ok('k huge -> all positives',LK.over.length===npos);
ok('k huge -> all negatives',LK.under.length===nneg);
ok('k=0 clamps to 1',selectivityEfficiencyLeaders(off,0).over.length===1);
ok('null k -> 3 (1 over here)',selectivityEfficiencyLeaders(off,null).over.length===1);

// 9. pred field consistency: pred + resid == actual
ok('pred+resid==earn',offR.every(d=>approx(d.pred+d.resid,d.u.median_earn_10yr,1e-6)));

// 10. empirical on the REAL universe: 249 usable, strongest gradient of the arc
const data=JSON.parse(fs.readFileSync('/home/hatch/repos/university-outcomes-tracker/data/universities.json','utf8'));
const real=data.universities;
const rmodel=selectivityEfficiencyModel(real);
ok('real n=249',rmodel!==null&&rmodel.n===249);
ok('real r in (-0.72,-0.62) (strongest selectivity gradient)',rmodel.r<-0.62&&rmodel.r>-0.72);
ok('real m<0 (more selective -> higher earnings)',rmodel.m<0);
const rr=selectivityEfficiencyResiduals(real);
ok('real residuals sorted desc',rr.every((d,i)=>i===0||rr[i-1].resid>=d.resid));
ok('real top residual positive',rr[0].resid>0);
ok('real bottom residual negative',rr[rr.length-1].resid<0);
ok('real residual sum ~0',Math.abs(rr.reduce((s,d)=>s+d.resid,0))<1e-3);
const rlead=selectivityEfficiencyLeaders(real,3);
ok('real leaders 3/3',rlead.over.length===3&&rlead.under.length===3);
ok('real over all positive',rlead.over.every(d=>d.resid>0));
ok('real under all negative',rlead.under.every(d=>d.resid<0));
console.log('real top access over-deliverer:',rr[0].u.name,'+$'+(rr[0].resid/1000).toFixed(1)+'k','('+(rr[0].u.admission_rate*100).toFixed(1)+'% admit)');
console.log('real worst under-deliverer:',rr[rr.length-1].u.name,'$'+(rr[rr.length-1].resid/1000).toFixed(1)+'k');
console.log(`selectivity efficiency v47: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
