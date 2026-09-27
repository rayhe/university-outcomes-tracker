// verify_touchtip_v35.js — unit test for the TOUCH-TIP-V35 block in js/app.js.
// The pure helper pinTipPos is mechanically extracted between
// TOUCH-TIP-V35-BEGIN/END markers (no transcription); run with `new Function`.
// Usage: node hidden_files/verify_touchtip_v35.js

const fs=require('fs'), path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','js','app.js'),'utf8');
const m=src.match(/\/\/ TOUCH-TIP-V35-BEGIN\n([\s\S]*?)\/\/ TOUCH-TIP-V35-END/);
if(!m){ console.error('FAIL: markers not found'); process.exit(1); }
const scope=new Function(m[1]+'; return {pinTipPos};');
const {pinTipPos}=scope();

let pass=0, fail=0;
function ok(cond, label){ if(cond){pass++;} else {fail++; console.error('FAIL:',label);} }
function eq(a,b,label){ ok(a.left===b.left && a.top===b.top, label+` (got {${a.left},${a.top}}, want {${b.left},${b.top}})`); }

// --- normal interior placement: offset (+12, -10-h) from the tap point ---
eq(pinTipPos(100,200,1200,800,230,96), {left:112, top:94}, 'interior placement');

// --- right edge: clamped so the tip stays inside the viewport ---
eq(pinTipPos(1150,200,1200,800,230,96), {left:962, top:94}, 'right edge clamps to vw-tipW-8');

// --- bottom edge: clamped vertically ---
eq(pinTipPos(100,760,1200,800,230,96), {left:112, top:654}, 'bottom edge clamps to vh-tipH-8');

// --- near left edge: never negative, floor 8 ---
eq(pinTipPos(0,200,1200,800,230,96), {left:12, top:94}, 'left floor at 8');
eq(pinTipPos(0,0,1200,800,230,96), {left:12, top:8}, 'top floor at 8');

// --- tiny viewport: tip wider than the viewport stays visible, not negative ---
eq(pinTipPos(100,100,200,600,230,96), {left:8, top:8}, 'tiny viewport degrades to 8,8 not negative');

// --- corner case: bottom-right corner of a normal viewport ---
eq(pinTipPos(1190,790,1200,800,230,96), {left:962, top:684}, 'bottom-right corner fully clamped');

// --- defaults when dims missing/invalid (matches the 230x96 used by pinLinkTip) ---
const d1=pinTipPos(100,200,1200,800,null,null);
const d2=pinTipPos(100,200,1200,800,230,96);
ok(d1.left===d2.left && d1.top===d2.top, 'null dims fall back to 230x96');
const d3=pinTipPos(100,200,1200,800,0,-5);
ok(d3.left===d2.left && d3.top===d2.top, 'zero/negative dims fall back to 230x96');

// --- integer output ---
const r=pinTipPos(100.4,200.7,1200,800,230,96);
ok(Number.isInteger(r.left) && Number.isInteger(r.top), 'returns integers');

// --- marker hygiene: the extracted block defines only the pure helper ---
ok(!m[1].includes('document') && !m[1].includes('window') && !m[1].includes('d3.'), 'extracted block is DOM/d3-free (pure)');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
