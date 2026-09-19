// v0.27 unit tests — peer benchmarking CSV export block (BENCH-CSV-V27).
// The tested block is mechanically extracted from js/app.js between
// BENCH-CSV-V27-START and BENCH-CSV-V27-END (no transcription), then run in a
// new Function scope with stubbed browser globals for the download path.
const fs=require('fs'), path=require('path');
const src=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
const START='// BENCH-CSV-V27-START', END='// BENCH-CSV-V27-END';
const si=src.indexOf(START), ei=src.indexOf(END);
if(si<0||ei<0||ei<si){ console.error('markers missing'); process.exit(1); }
const block=src.slice(si+START.length, ei);

// ---- stubbed browser surface for downloadBenchCSV ----
let clickedHref=null, blobContent=null, revoked=[];
const savedBlob=global.Blob, savedURL=global.URL;
global.Blob=function(parts){ blobContent=parts.join(''); };
global.URL={createObjectURL:()=>{ clickedHref='blob:benchcsv'; return clickedHref; }, revokeObjectURL:(h)=>{ revoked.push(h); }};
const elems=[];
global.document={createElement:(t)=>({tag:t, style:{}, href:'', download:'', click(){ clickedHref=this.href; }, remove(){}}), body:{appendChild(e){ elems.push(e); }}};
let lastAlert=null;
global.alert=(m)=>{ lastAlert=m; };
global.window={};

const factory=new Function('document','window','alert','Blob','URL', block+';return {benchGroupKey,groupBenchRows,benchCsvCell,buildBenchCSV,downloadBenchCSV};');
const {benchGroupKey,groupBenchRows,benchCsvCell,buildBenchCSV,downloadBenchCSV}=factory(global.document,global.window,global.alert,global.Blob,global.URL);

let pass=0, fail=0;
function ok(cond,label){ if(cond){pass++;} else {fail++; console.error('FAIL:',label);} }

function mk(id,name,opts){ return Object.assign({id,name,score:70,conference:'Big Ten',carnegie:'R1',control:'public',state:'IL',median_earn_10yr:60000,net_price_avg:15000},opts||{}); }

// ---- benchCsvCell (RFC 4180) ----
ok(benchCsvCell(null)==='','csv: null -> empty');
ok(benchCsvCell('Ivy')==='Ivy','csv: plain passthrough');
ok(benchCsvCell(42)==='42','csv: number passthrough');
ok(benchCsvCell('A, B')==='"A, B"','csv: comma quoted');
ok(benchCsvCell('A"B')==='"A""B"','csv: quote doubled');
ok(benchCsvCell('a\nb')==='"a\nb"','csv: newline quoted');

// ---- benchGroupKey ----
ok(benchGroupKey(mk('x','X',{conference:'SEC'}),'conference')==='SEC','key: conference direct');
ok(benchGroupKey(mk('x','X',{conference:'',peer_group:'AAC'}),'conference')==='AAC','key: conference falls back to peer_group');
ok(benchGroupKey(mk('x','X',{conference:'',peer_group:''}),'conference')==='Other','key: conference falls back to Other');
ok(benchGroupKey(mk('x','X'),'carnegie')==='R1','key: carnegie passthrough');
ok(benchGroupKey(mk('x','X'),'state')==='IL','key: state passthrough');
ok(benchGroupKey(mk('x','X'),'zzz')==='All','key: unknown mode -> All');

// ---- groupBenchRows: hand-computed fixture ----
const fix=[
  mk('a','Alpha',{score:90,median_earn_10yr:100000,net_price_avg:20000,conference:'Ivy'}),
  mk('b','Beta',{score:80,median_earn_10yr:80000,net_price_avg:10000,conference:'Ivy'}),
  mk('c','Gamma',{score:70,median_earn_10yr:60000,net_price_avg:15000,conference:'Big Ten'}),
  mk('d','Delta',{score:60,median_earn_10yr:50000,net_price_avg:10000,conference:'Big Ten'}),
  mk('e','Epsilon',{score:50,median_earn_10yr:40000,net_price_avg:5000,conference:'Big Ten'}),
  mk('f','Zeta',{score:75,median_earn_10yr:90000,net_price_avg:25000,conference:'',peer_group:'AAC'}),
];
const rows=groupBenchRows(fix,'conference');
ok(rows.length===3,'rows: 3 groups incl. peer_group fallback');
ok(rows[0].group==='Ivy'&&rows[1].group==='AAC'&&rows[2].group==='Big Ten','rows: sorted avgScore desc (Ivy 85, AAC 75, Big Ten 60)');
ok(rows[0].n===2&&rows[1].n===1&&rows[2].n===3,'rows: n per group');
ok(Math.abs(rows[0].avgScore-85)<1e-9,'rows: Ivy avgScore 85');
ok(Math.abs(rows[0].avgEarn-90000)<1e-9,'rows: Ivy avgEarn 90000');
// ROI: Alpha 100000-70000-80000=-50000; Beta 80000-70000-40000=-30000 -> mean -40000
ok(Math.abs(rows[0].avgROI-(-40000))<1e-9,'rows: Ivy avgROI hand-computed');
ok(rows[0].top3.length===2&&rows[0].top3[0].name==='Alpha'&&rows[0].top3[1].name==='Beta','rows: top3 sorted by score desc');
ok(rows[2].top3.length===3,'rows: top3 capped at 3');
ok(rows[2].top3[0].id==='c','rows: top3 carry ids');

// ---- groupBenchRows: carnegie mode ----
const rowsC=groupBenchRows(fix,'carnegie');
ok(rowsC.length===1&&rowsC[0].group==='R1'&&rowsC[0].n===6,'rows: carnegie mode groups correctly');

// ---- buildBenchCSV ----
const csv=buildBenchCSV(rows,'conference');
const lines=csv.split('\n');
ok(lines[0]==='conference_group,n,avg_score,avg_earn,avg_roi,top3','csv: header names');
ok(lines.length===4,'csv: header + 3 rows');
ok(lines[1]==='Ivy,2,85.00,90000,-40000,Alpha; Beta','csv: Ivy row exact (raw values, no quotes needed)');
ok(!/[<>]/.test(csv),'csv: no HTML leak');
ok(!/\r/.test(csv),'csv: no CR characters');

// quoting with commas in group names
const fixQ=[mk('g1','G1',{conference:'X, Y'}),mk('g2','G2',{conference:'X, Y'})];
const csvQ=buildBenchCSV(groupBenchRows(fixQ,'conference'),'conference');
ok(csvQ.split('\n')[1].startsWith('"X, Y",'),'csv: group name with comma quoted');

// ---- parity with the rendered table formula (avgScore/avgEarn/avgROI) ----
const big=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/universities.json'),'utf8')).universities;
['conference','carnegie','control','state'].forEach(mode=>{
  const rr=groupBenchRows(big,mode);
  const tot=rr.reduce((s,r)=>s+r.n,0);
  ok(tot===big.length, 'rows: '+mode+' covers all '+big.length+' unis (n sum '+tot+')');
  ok(rr.every((r,i,a)=>i===0||a[i-1].avgScore>=r.avgScore),'rows: '+mode+' sorted avgScore desc');
  ok(rr.every(r=>r.n>0&&r.top3.length>0&&r.top3.length<=3),'rows: '+mode+' n/top3 sane');
  const cc=buildBenchCSV(rr,mode);
  ok(cc.split('\n').length===rr.length+1,'csv: '+mode+' line count');
  ok(!/[<>]/.test(cc),'csv: '+mode+' no HTML leak');
});

// ---- downloadBenchCSV wiring (stubbed browser) ----
const bench=groupBenchRows(big,'conference');
global.window.__lastBench={rows:bench,mode:'conference'};
downloadBenchCSV();
ok(clickedHref==='blob:benchcsv','dl: object URL used');
ok(blobContent===buildBenchCSV(bench,'conference'),'dl: blob content matches buildBenchCSV');
const link=elems[elems.length-1];
ok(link.download==='university-benchmark-conference.csv','dl: filename university-benchmark-conference.csv');

// no saved bench -> alert
global.window.__lastBench=null; lastAlert=null;
downloadBenchCSV();
ok(lastAlert==='Peer benchmarking table not available','dl: alert when no bench data');

// control mode export smoke
const rowsCtl=groupBenchRows(big,'control');
const csvCtl=buildBenchCSV(rowsCtl,'control');
ok(csvCtl.split('\n')[0]==='control_group,n,avg_score,avg_earn,avg_roi,top3','csv: control-mode header uses mode name');

console.log(`v0.27 bench-csv tests: ${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
