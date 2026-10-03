// v0.41 radar axis-label layout verification. Mechanically extracts the RADAR-LABEL-V41
// block from js/app.js (no transcription) and unit-tests the pure layout helpers.
const fs=require('fs');
const src=fs.readFileSync('/home/hatch/repos/university-outcomes-tracker/js/app.js','utf8');
const a=src.indexOf('// RADAR-LABEL-V41-START'), b=src.indexOf('// RADAR-LABEL-V41-END');
if(a<0||b<0) throw new Error('RADAR-LABEL-V41 markers not found');
let block=src.slice(a,b);
// wrap in a function scope so const/let declarations stay local, then export them
const factory=new Function(block+'; return {RADAR_LABEL_FRAC,RADAR_LABEL_PX,RADAR_LABEL_MARGIN,radarLabelWidth,radarLabelAnchor,radarLabelLayout};');
const {RADAR_LABEL_FRAC,RADAR_LABEL_PX,RADAR_LABEL_MARGIN,radarLabelWidth,radarLabelAnchor,radarLabelLayout}=factory();

let pass=0,fail=0;
function ok(name,cond){ if(cond){pass++;}else{fail++;console.log('FAIL:',name);} }
const near=(x,y,eps)=>Math.abs(x-y)<(eps||1e-6);

// real renderer geometry + labels
const W=360,H=312,CX=180,CY=156,R=104,N=5;
const DIMS=[{label:'Career'},{label:'Alumni'},{label:'Academic'},{label:'Financial'},{label:'Value'}];

// 1. constants
ok('frac 1.30',RADAR_LABEL_FRAC===1.30);
ok('font px 10',RADAR_LABEL_PX===10);
ok('margin 12',RADAR_LABEL_MARGIN===12);

// 2. width estimates: chars * px * 0.62
ok('width Career',near(radarLabelWidth('Career'),6*10*0.62));
ok('width Financial',near(radarLabelWidth('Financial'),9*10*0.62));
ok('width empty',radarLabelWidth('')===0);
ok('width monotonic',radarLabelWidth('Academic')>radarLabelWidth('Alumni'));

// 3. anchor rule matches the v0.23 inline rule (middle/start/end by x vs center)
ok('anchor center',radarLabelAnchor(180,180)==='middle');
ok('anchor near-boundary',radarLabelAnchor(189.9,180)==='middle');
ok('anchor boundary-10',radarLabelAnchor(190,180)==='start'); // old rule: |dx|<10 middle, ==10 falls through to lx>cx
ok('anchor right',radarLabelAnchor(191,180)==='start');
ok('anchor left',radarLabelAnchor(170,180)==='end');

// 4. layout returns 5 entries in order with the expected anchors
const L=radarLabelLayout(DIMS,N,CX,CY,R,W,H);
ok('5 entries',L.length===5);
ok('anchors',L.map(e=>e.anchor).join(',')==='middle,start,start,end,end');

// 5. exact expected positions (130% radius, margin clamps)
ok('Career pos',near(L[0].x,180)&&near(L[0].y,20.8));
ok('Alumni pos',near(L[1].x,308.5828,1e-3)&&near(L[1].y,114.2209,1e-3));
ok('Academic pos',near(L[2].x,259.4686,1e-3)&&near(L[2].y,265.3791,1e-3));
ok('Financial pos',near(L[3].x,100.5314,1e-3)&&near(L[3].y,265.3791,1e-3));
ok('Value pos',near(L[4].x,51.4172,1e-3)&&near(L[4].y,114.2209,1e-3));

// 6. every label box keeps >=12px from all viewBox edges (the v0.41 guarantee)
function box(e,label){
  const w=radarLabelWidth(label);
  const x0=e.anchor==='middle'?e.x-w/2:(e.anchor==='start'?e.x:e.x-w);
  const x1=e.anchor==='middle'?e.x+w/2:(e.anchor==='start'?e.x+w:e.x);
  return {x0,x1,y0:e.y-RADAR_LABEL_PX*0.75,y1:e.y+RADAR_LABEL_PX*0.25};
}
const boxes=L.map((e,i)=>box(e,DIMS[i].label));
const minMargin=Math.min(...boxes.map(b=>Math.min(b.x0,W-b.x1,b.y0,H-b.y1)));
ok('min margin >=12',minMargin>=12);
console.log('   empirical min margin: '+minMargin.toFixed(2)+'px (Career top)');

// 7. the old tightness is gone: v0.23 parked Career at y=12 (glyph top 4.5px < 12);
//    the new helper at the OLD 340x300 geometry already lifts it to 19.5, and the
//    new 360x312 geometry gives glyph top 13.3 >= 12.
const oldL=radarLabelLayout(DIMS,N,170,144,104,340,300);
ok('old-geometry Career lifted',near(oldL[0].y,19.5));
ok('new-geometry Career top margin',boxes[0].y0>=12);

// 8. no pairwise label-box overlap (10 pairs)
let overlap=false;
for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
  const A=boxes[i],B=boxes[j];
  if(A.x0<B.x1&&B.x0<A.x1&&A.y0<B.y1&&B.y0<A.y1) overlap=true;
}
ok('no pairwise overlap',!overlap);

// 9. comfortable labels are untouched: Academic equals the raw 130% point
const rawA={x:CX+R*1.30*Math.cos(-Math.PI/2+2*2*Math.PI/5),y:CY+R*1.30*Math.sin(-Math.PI/2+2*2*Math.PI/5)};
ok('no-op when inside',near(L[2].x,rawA.x)&&near(L[2].y,rawA.y));

// 10. x-clamp: very long label at i=1 keeps exactly 12px from the right edge
const long1=radarLabelLayout([{label:'pad'},{label:'X'.repeat(40)}],5,CX,CY,R,W,H)[1];
ok('x clamp right',near(long1.x+radarLabelWidth('X'.repeat(40)),W-12));

// 11. y-clamp bottom with oversized R
const bot=radarLabelLayout([{label:'A'},{label:'B'},{label:'C'},{label:'D'}],4,CX,CY,200,W,H)[2];
ok('y clamp bottom',near(bot.y,H-12-2.5));

// 12. y-clamp top with oversized R
const top=radarLabelLayout([{label:'A'},{label:'B'},{label:'C'},{label:'D'}],4,CX,CY,200,W,H)[0];
ok('y clamp top',near(top.y,12+7.5));

// 13. determinism
ok('deterministic',JSON.stringify(radarLabelLayout(DIMS,N,CX,CY,R,W,H))===JSON.stringify(radarLabelLayout(DIMS,N,CX,CY,R,W,H)));

// 14. input immutability
const frozen=JSON.stringify(DIMS);
radarLabelLayout(DIMS,N,CX,CY,R,W,H);
ok('input immutable',JSON.stringify(DIMS)===frozen);

// 15. empty dims -> []
ok('empty dims',Array.isArray(radarLabelLayout([],N,CX,CY,R,W,H))&&radarLabelLayout([],N,CX,CY,R,W,H).length===0);

// 16. return shape
ok('shape',L.every(e=>Number.isFinite(e.x)&&Number.isFinite(e.y)&&['middle','start','end'].includes(e.anchor)));

// 17. anchor agreement with the v0.23 inline rule on unclamped positions
const v23rule=(lx,cx)=>Math.abs(lx-cx)<10?'middle':(lx>cx?'start':'end');
ok('v0.23 anchor agreement',DIMS.every((d,i)=>{
  const ang=-Math.PI/2+i*2*Math.PI/N, r=R*1.30;
  return radarLabelAnchor(CX+r*Math.cos(ang),CX)===v23rule(CX+r*Math.cos(ang),CX);
}));

console.log(`radar label v41: ${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
