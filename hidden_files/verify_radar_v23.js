// v0.23 radar toolkit verification. Mechanically extracts the RADAR-V23 block
// from js/app.js (no transcription) and unit-tests the pure math helpers.
const fs=require('fs');
const src=fs.readFileSync('/home/hatch/repos/university-outcomes-tracker/js/app.js','utf8');
const a=src.indexOf('// RADAR-V23-START'), b=src.indexOf('// RADAR-V23-END');
if(a<0||b<0) throw new Error('RADAR-V23 markers not found');
let block=src.slice(a,b);
// wrap in a function scope so const/let declarations stay local, then export them
const factory=new Function(block+'; return {RADAR_DIMS,radarExtents,radarNormVal,radarAverage,radarPoint};');
const {RADAR_DIMS,radarExtents,radarNormVal,radarAverage,radarPoint}=factory();

let pass=0,fail=0;
function ok(name,cond){ if(cond){pass++;}else{fail++;console.log('FAIL:',name);} }

// 1. five dims, distinct keys
ok('5 dims',RADAR_DIMS.length===5);
ok('distinct keys',new Set(RADAR_DIMS.map(d=>d.key)).size===5);

// synthetic schools
const U=(earn,giv,grad,endow,def)=>({median_earn_10yr:earn,alumni_giving:giv,grad_rate_6yr:grad,endowment_per_student:endow,loan_default:def});
const S=[U(50000,0.05,0.7,100000,0.05),U(100000,0.15,0.9,1000000,0.02),U(75000,0.10,0.8,300000,0.03)];

// 2. extents
const ext=radarExtents(S);
ok('career extent',ext.career[0]===50000&&ext.career[1]===100000);
ok('financial extent log',Math.abs(ext.financial[0]-Math.log(100000))<1e-9);
ok('value extent',ext.value[0]===0.95&&ext.value[1]===0.98);

// 3. normalization: lo->0, hi->100, mid->50, clamps
ok('norm lo=0',radarNormVal(ext,'career',50000)===0);
ok('norm hi=100',radarNormVal(ext,'career',100000)===100);
ok('norm mid=50',Math.abs(radarNormVal(ext,'career',75000)-50)<1e-9);
ok('norm clamp hi',radarNormVal(ext,'career',200000)===100);
ok('norm clamp lo',radarNormVal(ext,'career',10000)===0);
ok('norm nonfinite=0',radarNormVal(ext,'career',NaN)===0);
ok('norm zero-range=0',radarNormVal({career:[5,5]},'career',5)===0);

// 4. average of normalized values: midpoint school -> 50 on every dim
// (financial is log-normalized, so its raw midpoint is the geometric mean)
const Smid=[U(75000,0.10,0.8,Math.sqrt(100000*1000000),0.035)];
const mid=radarAverage(Smid,ext);
ok('mid avg 50 all',RADAR_DIMS.every(d=>Math.abs(mid[d.key]-50)<1e-9));
// empty list -> zeros, no crash
const emp=radarAverage([],ext);
ok('empty avg zeros',RADAR_DIMS.every(d=>emp[d.key]===0));

// 5. polar geometry: i=0 is top of circle, v scales radius linearly, v=0 is center
const cx=170,cy=150,R=104,n=5;
const p0=radarPoint(cx,cy,R,0,n,100);
ok('i0 top',Math.abs(p0[0]-cx)<1e-9&&Math.abs(p0[1]-(cy-R))<1e-9);
const p0h=radarPoint(cx,cy,R,0,n,50);
ok('half radius',Math.abs(p0h[1]-(cy-R/2))<1e-9);
const pzc=radarPoint(cx,cy,R,3,n,0);
ok('zero at center',Math.abs(pzc[0]-cx)<1e-9&&Math.abs(pzc[1]-cy)<1e-9);
// i=1 sits 72deg clockwise from top: x>cx, y<cy for the pentagon layout
const p1=radarPoint(cx,cy,R,1,n,100);
ok('i1 quadrant',p1[0]>cx&&p1[1]<cy);

// 6. non-finite source values are excluded from extents (endowment 0 -> log(1)=0 still finite)
const S2=[U(50000,0.05,0.7,0,0.05),U(100000,0.15,0.9,1000000,0.02)];
const ext2=radarExtents(S2);
ok('endow 0 guarded',Number.isFinite(ext2.financial[0])&&ext2.financial[0]===Math.log(1));

console.log(`radar v23: ${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
