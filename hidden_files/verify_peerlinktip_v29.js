// verify_peerlinktip_v29.js — unit test for the PEER-LINKTIP-V29 block in js/app.js.
// The block is mechanically extracted between PEER-LINKTIP-V29-BEGIN/END markers
// (no transcription); run with `new Function` scope.
// Usage: node hidden_files/verify_peerlinktip_v29.js

const fs=require('fs'), path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','js','app.js'),'utf8');
const m=src.match(/\/\/ PEER-LINKTIP-V29-BEGIN\n([\s\S]*?)\/\/ PEER-LINKTIP-V29-END/);
if(!m){ console.error('FAIL: markers not found'); process.exit(1); }
const scope=new Function(m[1]+'; return {escTip, peerLinkTip};');
const {escTip, peerLinkTip}=scope();

let pass=0, fail=0;
function ok(cond, label){ if(cond){pass++;} else {fail++; console.error('FAIL:',label);} }

// --- escTip ---
ok(escTip('Texas A&M')==='Texas A&amp;M', 'escTip escapes &');
ok(escTip('a<b>c')==='a&lt;b&gt;c', 'escTip escapes < and >');
ok(escTip('say "hi"')==='say &quot;hi&quot;', 'escTip escapes double quote');
ok(escTip(null)==='' && escTip(undefined)==='' && escTip('')==='', 'escTip null/undefined/empty -> empty string');
ok(escTip(42)==='42', 'escTip coerces numbers');

// --- basic tip shape ---
const A={name:'Alpha University', score:85, group:'Ivy', peer_group:'Ivy League'};
const B={name:'Beta College', score:80, group:'Ivy', peer_group:'Ivy League'};
const link={source:'a', target:'b', dist:35, str:0.42};
let t=peerLinkTip(A,B,'conference',link);
ok(t.includes('<b>Alpha University</b> &#8596; <b>Beta College</b>'), 'tip names joined with arrow');
ok(t.includes('same conference (Ivy)'), 'tip group line with conference label');
ok(t.includes('Scores 85.0 / 80.0 (&#916;5.0)'), 'tip score proximity Delta');
ok(t.includes('Link strength 0.420'), 'tip strength toFixed(3)');
ok(t.includes('same peer_group Ivy League (tighter link)'), 'tip peer_group bonus note when same pg');
ok(peerLinkTip(A,B,'conference',link)===t, 'tip deterministic across calls');

// --- mode labels ---
ok(peerLinkTip(A,B,'carnegie',link).includes('same Carnegie tier (Ivy)'), 'carnegie mode label');
ok(peerLinkTip(A,B,'control',link).includes('same control (Ivy)'), 'control mode label');
ok(peerLinkTip(A,B,'state',link).includes('same state (Ivy)'), 'state mode label');
ok(peerLinkTip(A,B,'bogus',link).includes('same group (Ivy)'), 'unknown mode falls back to "group"');

// --- group fallback ---
ok(peerLinkTip({...A,group:''},{...B,group:'Big Ten'},'conference',link).includes('(Big Ten)'), 'group falls back to b.group');
ok(peerLinkTip({name:'X',score:80},{name:'Y',score:80},'conference',link).includes('(Other)'), 'missing groups -> Other');

// --- missing scores / link ---
let t2=peerLinkTip({name:'X'},{name:'Y',score:80},'conference',link);
ok(t2.includes('Scores ? / 80.0') && !t2.includes('&#916;'), 'missing score -> ? and no Delta');
ok(peerLinkTip(A,B,'conference',{}).includes('Link strength n/a'), 'missing link.str -> n/a');
ok(peerLinkTip(A,B,'conference',null).includes('Link strength n/a'), 'null link -> n/a');

// --- peer_group bonus gating ---
const C={...B, peer_group:'Big Ten'};
ok(!peerLinkTip(A,C,'conference',link).includes('same peer_group'), 'different peer_group -> no bonus note');
ok(!peerLinkTip({name:'X',score:80},{name:'Y',score:80},'conference',link).includes('same peer_group'), 'missing peer_group -> no bonus note');

// --- HTML escaping in tip (real names with & and injection) ---
let t3=peerLinkTip({name:'Texas A&M <script>alert(1)</script>', score:85, group:'SEC'}, {name:'William & Mary', score:84, group:'SEC'}, 'conference', link);
ok(t3.includes('Texas A&amp;M &lt;script&gt;alert(1)&lt;/script&gt;'), 'tip escapes name with & and tags');
ok(!t3.includes('<script>'), 'tip has no raw <script> leak');
ok(t3.includes('William &amp; Mary'), 'tip escapes & in second name');

// --- real-universe smoke: names from the actual dataset ---
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','universities.json'),'utf8'));
const recs=data.universities;
let seen=0;
for(let i=0;i<recs.length-1;i+=17){
  const r1=recs[i], r2=recs[i+1];
  const tt=peerLinkTip({name:r1.name,score:r1.score,group:'SEC',peer_group:'SEC'},{name:r2.name,score:r2.score,group:'SEC',peer_group:'SEC'},'conference',{source:r1.id,target:r2.id,str:0.3});
  if(!tt.includes('<b>') || !tt.includes('&#8596;') || !tt.includes('Link strength')){ console.error('FAIL: real-data smoke pair',i); fail++; }
  else pass++;
  seen++;
}
ok(seen>5, 'real-universe smoke ran over '+seen+' pairs');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
