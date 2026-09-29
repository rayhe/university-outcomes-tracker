// verify_maplabel_v37.js — unit tests for the MAP-LABEL-V37 block in js/app.js.
// placeLabels is mechanically extracted between MAP-LABEL-V37-BEGIN/END
// markers (no transcription); run with `new Function`.
// Usage: node hidden_files/verify_maplabel_v37.js

const fs=require('fs'), path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','js','app.js'),'utf8');
const m=src.match(/\/\/ MAP-LABEL-V37-BEGIN\n([\s\S]*?)\/\/ MAP-LABEL-V37-END/);
if(!m){ console.error('FAIL: markers not found'); process.exit(1); }
const scope=new Function(m[1]+'; return {placeLabels};');
const {placeLabels}=scope();

let pass=0, fail=0;
function ok(cond, label){ if(cond){pass++;} else {fail++; console.error('FAIL:',label);} }
function findBy(placed, text){ return placed.find(p=>p.text===text); }

// T1: spread-out labels keep the old default placement (right anchor, x+7/y+3)
{
  const r=placeLabels([
    {x:100,y:100,text:'AA',priority:3},
    {x:300,y:200,text:'BB',priority:2},
    {x:500,y:300,text:'CC',priority:1},
  ], 800, 416);
  ok(r.length===3, 'T1: all 3 placed, got '+r.length);
  ok(r.every(p=>p.anchor==='start'), 'T1: all use right anchor');
  const a=findBy(r,'AA');
  ok(a.x===107&&a.y===103, 'T1: AA at (107,103), got ('+a.x+','+a.y+')');
}

// T2: two coincident labels — lower priority falls back to the left anchor
{
  const r=placeLabels([
    {x:50,y:50,text:'AA',priority:2},
    {x:50,y:50,text:'BB',priority:1},
  ], 800, 416);
  ok(r.length===2, 'T2: both placed via fallback anchors, got '+r.length);
  const a=findBy(r,'AA'), b=findBy(r,'BB');
  ok(a.anchor==='start'&&a.x===57&&a.y===53, 'T2: AA right (57,53), got ('+a.x+','+a.y+','+a.anchor+')');
  ok(b.anchor==='end'&&b.x===43&&b.y===53, 'T2: BB left (43,53), got ('+b.x+','+b.y+','+b.anchor+')');
}

// T3: an unplaceable high-priority label is dropped without halting the rest
{
  const r=placeLabels([
    {x:40,y:20,text:'01234567890123456789',priority:9},
    {x:20,y:20,text:'AA',priority:1},
  ], 80, 40);
  ok(r.length===1, 'T3: one dropped, one placed, got '+r.length);
  ok(r[0].text==='AA'&&r[0].x===27&&r[0].y===23, 'T3: AA placed at (27,23), got ('+r[0].x+','+r[0].y+')');
}

// T4: priority order is internal — input order does not change the result
{
  const hi=[{x:50,y:50,text:'AA',priority:2},{x:50,y:50,text:'BB',priority:1}];
  const lo=[{x:50,y:50,text:'BB',priority:1},{x:50,y:50,text:'AA',priority:2}];
  ok(JSON.stringify(placeLabels(hi,800,416))===JSON.stringify(placeLabels(lo,800,416)), 'T4: input order irrelevant (priority-sorted internally)');
}

// T5: right-edge label falls back to the left anchor (stays in viewport)
{
  const r=placeLabels([{x:190,y:100,text:'AA',priority:5}], 200, 416);
  ok(r.length===1, 'T5: placed, got '+r.length);
  ok(r[0].anchor==='end'&&r[0].x===183&&r[0].y===103, 'T5: left anchor (183,103), got ('+r[0].x+','+r[0].y+','+r[0].anchor+')');
}

// T6: right+left blocked for the same-x lower label, top blocked too for the
// third — exercises the bottom anchor: A1(100,100)p3, A2(90,100)p2, B(100,100)p1
{
  const r=placeLabels([
    {x:100,y:100,text:'AA',priority:3},
    {x:90,y:100,text:'CC',priority:2},
    {x:100,y:100,text:'BB',priority:1},
  ], 800, 416);
  ok(r.length===3, 'T6: all 3 placed, got '+r.length);
  const a1=findBy(r,'AA'), a2=findBy(r,'CC'), b=findBy(r,'BB');
  ok(a1.anchor==='start'&&a1.x===107, 'T6: AA right');
  ok(a2.anchor==='end'&&a2.x===83, 'T6: CC left (83), got ('+a2.x+','+a2.anchor+')');
  ok(b.anchor==='start'&&b.x===107&&b.y===117, 'T6: BB bottom (107,117), got ('+b.x+','+b.y+','+b.anchor+')');
}

// T7: top anchor is reachable (right blocked by an overlapping box above)
{
  const r=placeLabels([
    {x:100,y:101,text:'AA',priority:2},
    {x:100,y:100,text:'BB',priority:1},
  ], 800, 416);
  const b=findBy(r,'BB');
  ok(r.length===2&&b.anchor==='start'&&b.x===107&&b.y===91, 'T7: BB top (107,91), got ('+b.x+','+b.y+','+b.anchor+')');
}

// T8: near-top-edge label uses the bottom anchor (stays inside viewport)
{
  const r=placeLabels([{x:400,y:2,text:'AA',priority:1}], 800, 416);
  ok(r.length===1&&r[0].x===407&&r[0].y===19&&r[0].anchor==='start', 'T8: bottom anchor (407,19), got '+JSON.stringify(r[0]));
}

// T9: text wider than the viewport is dropped (no anchor fits)
{
  const r=placeLabels([{x:400,y:200,text:'x'.repeat(30),priority:1}], 200, 416);
  ok(r.length===0, 'T9: over-wide label dropped, got '+r.length);
}

// T10: return shape is {text,x,y,anchor}
{
  const r=placeLabels([{x:100,y:100,text:'AA',priority:1}], 800, 416);
  const k=Object.keys(r[0]).sort().join(',');
  ok(k==='anchor,text,x,y', 'T10: shape {text,x,y,anchor}, got '+k);
}

console.log('maplabel_v37: '+pass+' pass, '+fail+' fail');
process.exit(fail?1:0);
