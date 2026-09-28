// verify_peerlegend_v36.js — unit test for the PEER-LEGEND-V36 block in js/app.js.
// The pure helpers escLegend + legendChipHtml are mechanically extracted between
// PEER-LEGEND-V36-BEGIN/END markers (no transcription); run with `new Function`.
// Usage: node hidden_files/verify_peerlegend_v36.js

const fs=require('fs'), path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','js','app.js'),'utf8');
const m=src.match(/\/\/ PEER-LEGEND-V36-BEGIN\n([\s\S]*?)\/\/ PEER-LEGEND-V36-END/);
if(!m){ console.error('FAIL: markers not found'); process.exit(1); }
const scope=new Function(m[1]+'; return {escLegend, legendChipHtml};');
const {escLegend, legendChipHtml}=scope();

let pass=0, fail=0;
function ok(cond, label){ if(cond){pass++;} else {fail++; console.error('FAIL:',label);} }

// --- escaping ---
ok(escLegend('Texas A&M')==='Texas A&amp;M', 'ampersand escaped');
ok(escLegend('a<b>"c"')==='a&lt;b&gt;&quot;c&quot;', 'angle brackets + quotes escaped');
ok(escLegend(null)==='' && escLegend(undefined)==='', 'null/undefined -> empty string');
ok(escLegend(42)==='42', 'number coerced');

// --- empty guard ---
ok(legendChipHtml({},[],()=> '#fff')==='', 'empty groupKeys -> empty string');
ok(legendChipHtml({},null,()=> '#fff')==='', 'null groupKeys -> empty string');

// --- chip shape: dot, name, count, color applied ---
const groups={Ivy:[{id:'a'},{id:'b'}], SEC:[{id:'c'}]};
const html=legendChipHtml(groups,['Ivy','SEC'],g=>g==='Ivy'?'#4e79a7':'#f28e2b');
ok(html.includes('peer-legend-chip'), 'chip class present');
ok(html.includes('peer-legend-dot'), 'dot class present');
ok(html.includes('background:#4e79a7') && html.includes('background:#f28e2b'), 'per-group color applied');
ok(html.includes('Ivy <b>2</b>') && html.includes('SEC <b>1</b>'), 'name + count rendered');

// --- ALL groups rendered (the v0.35 bug: SVG legend showed only 18) ---
const many={}, keys=[];
for(let i=0;i<45;i++){ const g='Conf'+i; keys.push(g); many[g]=[{id:'u'+i}]; }
const bigHtml=legendChipHtml(many,keys,g=>'#abc');
const chips=(bigHtml.match(/peer-legend-chip/g)||[]).length;
ok(chips===45, 'all 45 groups rendered (got '+chips+')');
ok(bigHtml.includes('Conf44 <b>1</b>'), 'last (45th) group present');

// --- missing groups entry -> count 0, no crash ---
const miss=legendChipHtml({},['Nope'],g=>'#fff');
ok(miss.includes('Nope <b>0</b>'), 'missing group renders count 0');

// --- colorOf fallback when not a function ---
const fb=legendChipHtml(groups,['Ivy'],null);
ok(fb.includes('background:#9aa0b8'), 'non-function colorOf falls back to muted gray');

// --- group names with special chars are escaped, colors too ---
const tricky=legendChipHtml({'A&B':[{}]},['A&B'],()=>'"><script>alert(1)</script>');
ok(tricky.includes('A&amp;B'), 'group name escaped');
ok(!tricky.includes('<script>'), 'no raw script leak via color');

// --- determinism ---
const h1=legendChipHtml(many,keys,g=>'#abc');
const h2=legendChipHtml(many,keys,g=>'#abc');
ok(h1===h2, 'deterministic output');

// --- order follows groupKeys, not groups insertion ---
const ord=legendChipHtml({'Z':[{}],'A':[{}]},['A','Z'],()=>'#fff');
ok(ord.indexOf('A <b>')<ord.indexOf('Z <b>'), 'order follows groupKeys');

console.log(pass+'/'+(pass+fail)+' pass');
if(fail) process.exit(1);
