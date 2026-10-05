// v0.43 resource-efficiency residual verification. Mechanically extracts the
// EFFICIENCY-V43 block from js/app.js (no transcription) and unit-tests the
// pure helpers. The block is self-contained (own OLS + Pearson), so the
// standard marker-extraction pattern works unchanged.
const fs=require('fs');
const src=fs.readFileSync('/home/hatch/repos/university-outcomes-tracker/js/app.js','utf8');
const a=src.indexOf('// EFFICIENCY-V43-START'), b=src.indexOf('// EFFICIENCY-V43-END');
if(a<0||b<0) throw new Error('EFFICIENCY-V43 markers not found');
let block=src.slice(a,b);
const factory=new Function(block+'; return {efficiencyModel,efficiencyResiduals,efficiencyLeaders};');
const {efficiencyModel,efficiencyResiduals,efficiencyLeaders}=factory();

let pass=0,fail=0;
function ok(name,cond){ if(cond){pass++;}else{fail++;console.log('FAIL:',name);} }
const approx=(x,y,t)=>Math.abs(x-y)<=(t==null?1e-9:t);

// synthetic schools: endowment_per_student = e^lx so log() = lx exactly
const U=(id,lx,earn,conf)=>({id,name:'U'+id,median_earn_10yr:earn,endowment_per_student:Math.exp(lx),conference:conf||'Test',control:'public'});

// 1. degenerate inputs -> null model, empty residuals/leaders
ok('null unis -> null',efficiencyModel(null)===null);
ok('empty -> null',efficiencyModel([])===null);
ok('single -> null',efficiencyModel([U('a',1,50000)])===null);
ok('empty residuals',efficiencyResiduals([]).length===0);
ok('leaders empty',efficiencyLeaders([],'x').over.length===0&&efficiencyLeaders([],3).under.length===0);

// 2. records with missing/zero endowment or missing earnings are excluded
const mixed=[U('a',1,50000),{id:'b',median_earn_10yr:60000},U('c',2,null),U('d',3,0),{id:'e',median_earn_10yr:70000,endowment_per_student:0}];
const mm=efficiencyModel(mixed);
ok('usable n=2 (a kept, d with earn=0 kept, b/c/e excluded)',mm!==null&&mm.n===2);

// 3. exact OLS on a perfect line: lx=[1,2,3], earn=10k*lx -> m=10000, b=0, r=1
const line=[U('l1',1,10000),U('l2',2,20000),U('l3',3,30000)];
const lm=efficiencyModel(line);
ok('line m=10000',approx(lm.m,10000));
ok('line b=0',approx(lm.b,0));
ok('line r=1',approx(lm.r,1));
ok('line n=3',lm.n===3);

// 4. residuals ~0 on the line; sum of residuals ~0 (OLS property)
const lr=efficiencyResiduals(line);
ok('on-line residuals ~0',lr.every(d=>Math.abs(d.resid)<1e-6));
ok('residual sum ~0',Math.abs(lr.reduce((s,d)=>s+d.resid,0))<1e-6);

// 5. a school above the line gets a positive residual, below -> negative
const off=[U('l1',1,10000),U('l2',2,20000),U('l3',3,30000),U('hi',2,25000),U('lo',2,15000)];
const offR=efficiencyResiduals(off);
const hi=offR.find(d=>d.u.id==='hi'), lo=offR.find(d=>d.u.id==='lo');
ok('above-line positive',hi.resid>0);
ok('below-line negative',lo.resid<0);
ok('hi ranked before lo',offR.indexOf(hi)<offR.indexOf(lo));

// 6. sorted desc; deterministic tie-break by id
ok('sorted desc',offR.every((d,i)=>i===0||offR[i-1].resid>=d.resid));
const tieA=U('a',1,10000), tieB=U('b',1,10000);
const tieR=efficiencyResiduals([tieB,tieA,line[2]]); // input order shuffled
const tied=tieR.filter(d=>d.u.id==='a'||d.u.id==='b');
ok('tie-break by id',tied[0].u.id==='a'&&tied[1].u.id==='b');
const again=efficiencyResiduals([tieB,tieA,line[2]]);
ok('deterministic',JSON.stringify(tieR.map(d=>d.u.id))===JSON.stringify(again.map(d=>d.u.id)));

// 7. input immutability
const snap=JSON.stringify(off);
efficiencyResiduals(off); efficiencyLeaders(off,2);
ok('input not mutated',JSON.stringify(off)===snap);

// 8. leaders: default k=3, clamping, ordering, sign discipline
const L=efficiencyLeaders(off); // hi>0 only over; lo<0 only under
ok('default k=3',L.over.length===1&&L.under.length===1);
ok('over is hi',L.over[0].u.id==='hi');
ok('under most-negative first',L.under[0].u.id==='lo');
const big=[U('p1',1,50000),U('p2',1,40000),U('p3',1,30000),U('q1',1,5000),U('q2',1,6000),U('base',1,20000),U('base2',1,20000)];
const LB=efficiencyLeaders(big,2);
ok('k=2 caps',LB.over.length===2&&LB.under.length===2);
ok('over desc order',LB.over[0].resid>=LB.over[1].resid);
ok('under asc order (most negative first)',LB.under[0].resid<=LB.under[1].resid);
ok('k=0 clamps to 1',efficiencyLeaders(big,0).over.length===1);
ok('k huge -> all (over=3, under=4: zero-dx fit makes both bases negative)',efficiencyLeaders(big,99).over.length===3&&efficiencyLeaders(big,99).under.length===4);
ok('null k -> 3',efficiencyLeaders(big,null).over.length===3);

// 9. pred field consistency: pred + resid == actual
ok('pred+resid==earn',offR.every(d=>approx(d.pred+d.resid,d.u.median_earn_10yr,1e-6)));

// 10. empirical on the REAL universe: 249 usable, sane model, sorted
const data=JSON.parse(fs.readFileSync('/home/hatch/repos/university-outcomes-tracker/data/universities.json','utf8'));
const real=data.universities;
const rmodel=efficiencyModel(real);
ok('real n=249',rmodel!==null&&rmodel.n===249);
ok('real r in (0,1)',rmodel.r>0&&rmodel.r<1);
ok('real m>0 (more resources -> more earnings)',rmodel.m>0);
const rr=efficiencyResiduals(real);
ok('real residuals sorted desc',rr.every((d,i)=>i===0||rr[i-1].resid>=d.resid));
ok('real top residual positive',rr[0].resid>0);
ok('real bottom residual negative',rr[rr.length-1].resid<0);
ok('real residual sum ~0',Math.abs(rr.reduce((s,d)=>s+d.resid,0))<1e-3);
const rlead=efficiencyLeaders(real,3);
ok('real leaders 3/3',rlead.over.length===3&&rlead.under.length===3);
ok('real over all positive',rlead.over.every(d=>d.resid>0));
ok('real under all negative',rlead.under.every(d=>d.resid<0));
console.log('real top converter:',rr[0].u.name,'+$'+(rr[0].resid/1000).toFixed(1)+'k');
console.log('real worst under-converter:',rr[rr.length-1].u.name,'$'+(rr[rr.length-1].resid/1000).toFixed(1)+'k');
console.log(`efficiency v43: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
