// verify_mapdots_v39.js — unit tests for the MAP-DOTSPREAD-V39 block in js/app.js.
// spreadDots is mechanically extracted between MAP-DOTSPREAD-V39-BEGIN/END
// markers (no transcription); run with `new Function`.
// Usage: node hidden_files/verify_mapdots_v39.js

const fs=require('fs'), path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','js','app.js'),'utf8');
const m=src.match(/\/\/ MAP-DOTSPREAD-V39-BEGIN\n([\s\S]*?)\/\/ MAP-DOTSPREAD-V39-END/);
if(!m){ console.error('FAIL: markers not found'); process.exit(1); }
const scope=new Function(m[1]+'; return {spreadDots};');
const {spreadDots}=scope();

let pass=0, fail=0;
function ok(cond, label){ if(cond){pass++;} else {fail++; console.error('FAIL:',label);} }
const dist=(a,b)=>Math.hypot(a.x-b.x, a.y-b.y);
const overlaps=(dots)=>{ // pairs closer than the helper's 0.85 separation target
  let n=0;
  for(let i=0;i<dots.length;i++)for(let j=i+1;j<dots.length;j++)
    if(dist(dots[i],dots[j])<(dots[i].r+dots[j].r)*0.85) n++;
  return n;
};

// T1: empty and single-dot inputs are no-ops
{
  ok(spreadDots([]).length===0, 'T1: empty in, empty out');
  const r=spreadDots([{x:10,y:10,r:3}]);
  ok(r.length===1&&r[0].dx===0&&r[0].dy===0, 'T1: single dot unmoved');
}

// T2: well-separated dots are untouched
{
  const r=spreadDots([{x:0,y:0,r:3},{x:100,y:100,r:3}]);
  ok(r[0].dx===0&&r[0].dy===0&&r[1].dx===0&&r[1].dy===0, 'T2: separated pair unmoved');
}

// T3: an overlapping pair is pushed apart (symmetrically, distance grows)
{
  const before=[{x:0,y:0,r:3},{x:4,y:0,r:3}]; // dist 4 < 5.1 target
  const d0=dist(before[0],before[1]);
  const r=spreadDots(before);
  const d1=dist(r[0],r[1]);
  ok(d1>d0, 'T3: distance increased ('+d0.toFixed(2)+' -> '+d1.toFixed(2)+')');
  ok(Math.abs(r[0].dx+r[1].dx)<1e-9&&Math.abs(r[0].dy+r[1].dy)<1e-9, 'T3: equal-and-opposite displacement');
}

// T4: coincident pair separates via deterministic tiebreak
{
  const c=[{x:50,y:50,r:3},{x:50,y:50,r:3}];
  const r1=spreadDots(c), r2=spreadDots(c);
  ok(dist(r1[0],r1[1])>0.5, 'T4: coincident pair separated, dist='+dist(r1[0],r1[1]).toFixed(2));
  ok(JSON.stringify(r1)===JSON.stringify(r2), 'T4: deterministic across runs');
}

// T5: input is not mutated
{
  const before=[{x:0,y:0,r:3},{x:4,y:0,r:3}];
  spreadDots(before);
  ok(before[0].x===0&&before[1].x===4, 'T5: input positions unchanged');
}

// T6: displacement is clamped to maxShift even under crush
{
  const many=[]; for(let i=0;i<20;i++) many.push({x:200,y:200,r:3.5});
  const r=spreadDots(many);
  const maxS=Math.max(...r.map(d=>Math.hypot(d.dx,d.dy)));
  ok(maxS<=10+1e-9, 'T6: max displacement '+maxS.toFixed(2)+' <= 10');
  ok(overlaps(r)<overlaps(many), 'T6: overlaps reduced even when clamped ('+overlaps(many)+' -> '+overlaps(r)+')');
}

// T7: a synthetic dense cluster (12 coincident dots, Boston-style) spreads out
{
  const cl=[]; for(let i=0;i<12;i++) cl.push({x:800,y:150,r:3.2});
  const r=spreadDots(cl);
  ok(overlaps(r)<overlaps(cl), 'T7: cluster overlaps reduced ('+overlaps(cl)+' -> '+overlaps(r)+')');
  ok(r.every(d=>Math.hypot(d.dx,d.dy)<=10+1e-9), 'T7: all within honesty bound');
}

// T8: opts honored — passes=0 and maxShift=0 mean no movement
{
  const a=[{x:0,y:0,r:3},{x:4,y:0,r:3}];
  const r0=spreadDots(a,{passes:0});
  ok(r0[0].dx===0&&r0[1].dx===0, 'T8: passes=0 no-op');
  const r1=spreadDots(a,{maxShift:0});
  ok(r1[0].dx===0&&r1[1].dx===0, 'T8: maxShift=0 no-op');
}

// T9: return shape carries radius and delta for every dot
{
  const r=spreadDots([{x:1,y:2,r:4},{x:2,y:3,r:5}]);
  ok(r.length===2&&r.every(d=>typeof d.x==='number'&&typeof d.y==='number'&&typeof d.dx==='number'&&typeof d.dy==='number'&&typeof d.r==='number'), 'T9: {x,y,r,dx,dy} shape');
}

// T10: empirical check on real data (rough linear projection, same as v0.37's
// empirical check) — overlap count must drop and no dot may move > 10px
{
  const data=require(path.join(__dirname,'..','data','universities.json'));
  const pts=data.universities.filter(u=>u.lat!=null&&u.lon!=null);
  const w=980, h=Math.round(w*0.52);
  let loMin=1e9,loMax=-1e9,laMin=1e9,laMax=-1e9;
  pts.forEach(u=>{loMin=Math.min(loMin,u.lon);loMax=Math.max(loMax,u.lon);laMin=Math.min(laMin,u.lat);laMax=Math.max(laMax,u.lat);});
  const dots=pts.map(u=>({x:(u.lon-loMin)/(loMax-loMin)*w*0.9+w*0.05,
                          y:(1-(u.lat-laMin)/(laMax-laMin))*h*0.9+h*0.05,
                          r:2.2+u.score/48}));
  const before=overlaps(dots);
  const r=spreadDots(dots);
  const after=overlaps(r);
  ok(after<before, 'T10: real-data overlaps reduced ('+before+' -> '+after+')');
  ok(r.every(d=>Math.hypot(d.dx,d.dy)<=10+1e-9), 'T10: all real dots within 10px bound');
}

console.log(pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
