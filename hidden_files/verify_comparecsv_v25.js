// v0.25 compare-table CSV export unit tests.
// The tested block is MECHANICALLY extracted from js/app.js between the
// COMPARE-CSV-V25-START / COMPARE-CSV-V25-END markers (no transcription).
const fs=require('fs');
const src=fs.readFileSync('/home/hatch/repos/university-outcomes-tracker/js/app.js','utf8');
const s=src.indexOf('// COMPARE-CSV-V25-START'), e=src.indexOf('// COMPARE-CSV-V25-END');
if(s<0||e<0||e<s) throw new Error('markers not found');
const block=src.slice(s,e);
// fmtMoney stub must match app.js line 7 semantics exactly
function fmtMoney(n){ if(n>=1e9) return '$'+(n/1e9).toFixed(1)+'B'; if(n>=1e6) return '$'+(n/1e6).toFixed(1)+'M'; if(n>=1e3) return '$'+(n/1e3).toFixed(0)+'k'; return '$'+n; }
const f=new Function(fmtMoney.toString()+';'+block+'; return {COMPARE_DIMS,compareRaw,isMoneyDim,isPctDim,compareCellHTML,csvCell,buildCompareCSV};');
const T=f();

let pass=0, fail=0;
function ok(name,cond){ if(cond){pass++;} else {fail++; console.log('FAIL:',name);} }

// --- synthetic fixtures ---
const A={id:'a',name:'University of Test, Main Campus',score:88.5,conference:'Test Conf',carnegie:'R1',control:'Private',
  median_earn_10yr:150000,median_earn_10yr_real:150000,debt_avg:12000,loan_default:0.05,net_price_avg:20000,
  grad_rate_6yr:0.9,retention:0.97,endowment_per_student:2500000,admission_rate:0.04,enrollment_fte:20000};
const B={id:'b',name:'Quote "U"',score:77.4,conference:'',carnegie:'Baccalaureate',control:'Public',
  median_earn_10yr:90000,debt_avg:15000,loan_default:0.08,net_price_avg:12000,
  grad_rate_6yr:0.75,retention:0.88,endowment_per_student:50000,admission_rate:0.6,enrollment_fte:15000};

// 1. dims list preserved (14, order matches old inline array)
ok('dims len/order', JSON.stringify(T.COMPARE_DIMS)===JSON.stringify(['score','conference','carnegie','control','median_earn_10yr','debt_avg','loan_default','net_price_avg','grad_rate_6yr','retention','endowment_per_student','admission_rate','enrollment_fte','roi_10yr']));

// 2. compareRaw: roi math, direct, _real numeric fallback, null
ok('raw roi', T.compareRaw(A,'roi_10yr')===150000-70000-80000);
const C=Object.assign({},B,{median_earn_10yr:null,median_earn_10yr_real:88000});
ok('raw _real fallback', T.compareRaw(C,'median_earn_10yr')===88000);
const D=Object.assign({},B,{admission_rate:null});
ok('raw null', T.compareRaw(D,'admission_rate')===null);
ok('raw direct', T.compareRaw(A,'score')===88.5);

// 3. csvCell escaping
ok('csv comma', T.csvCell('University of Test, Main Campus')==='"University of Test, Main Campus"');
ok('csv quote', T.csvCell('Quote "U"')==='"Quote ""U"""');
ok('csv plain', T.csvCell('R1')==='R1');
ok('csv null', T.csvCell(null)==='');

// 4. buildCompareCSV structure + values
const csv=T.buildCompareCSV([A,B]);
const lines=csv.split('\n');
ok('csv 15 lines (header+14 dims)', lines.length===15);
ok('csv header', lines[0]==='Metric,"University of Test, Main Campus","Quote ""U"""');
const row=k=>lines.find(l=>l.split(',')[0]===k);
ok('csv score raw not formatted', row('score')==='score,88.5,77.4');
ok('csv earn raw', row('median_earn_10yr')==='median_earn_10yr,150000,90000');
ok('csv grad raw decimal', row('grad_rate_6yr')==='grad_rate_6yr,0.9,0.75');
ok('csv roi raw', row('roi_10yr')==='roi_10yr,'+(150000-70000-80000)+','+(90000-70000-48000));
ok('csv conf quoted-safe empty', row('conference')==='conference,Test Conf,');
ok('csv null->empty', T.buildCompareCSV([D,B]).split('\n').find(l=>l.split(',')[0]==='admission_rate')==='admission_rate,,0.6');

// 5. compareCellHTML behavioral parity with the old inline renderer (read from app.js logic):
//    money -> fmtMoney, pct -> x100 + '%', other numbers -> toFixed(1), categorical as-is, realBadge rules
ok('cell money', T.compareCellHTML(A,'median_earn_10yr')==='<td>$150k <span style="font-size:.65rem;color:#3dd598">●real</span></td>');
ok('cell pct', T.compareCellHTML(A,'loan_default')==='<td>5.0%</td>');
ok('cell toFixed1', T.compareCellHTML(A,'score')==='<td>88.5</td>');
ok('cell categorical', T.compareCellHTML(A,'control')==='<td>Private</td>');
ok('cell empty-conf', T.compareCellHTML(B,'conference')==='<td>—</td>');
ok('cell no-badge-when-no-real-flag', T.compareCellHTML(B,'score')==='<td>77.4</td>');
ok('cell _real fallback formatted', T.compareCellHTML(C,'median_earn_10yr')==='<td>$88k <span style="font-size:.65rem;color:#3dd598">●real</span></td>');
ok('cell null->dash', T.compareCellHTML(D,'admission_rate')==='<td>—</td>');

// 6. real 200-universe: CSV builds, all rows present, no '—' leak into CSV, quoting applied where needed
const data=JSON.parse(fs.readFileSync('/home/hatch/repos/university-outcomes-tracker/data/universities.json','utf8')).universities;
const trio=[data[0],data[1],data[2]];
const csv3=T.buildCompareCSV(trio);
ok('csv 200-universe 15 lines', csv3.split('\n').length===15);
ok('csv no em-dash values', !csv3.split('\n').slice(1).some(l=>/(?:^|,)—(?:,|$)/.test(l)));
ok('csv no "real" badges', !csv3.includes('●real'));
ok('cellHTML 200-universe smoke', trio.every(u=>T.COMPARE_DIMS.every(k=>T.compareCellHTML(u,k).startsWith('<td>'))));

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
