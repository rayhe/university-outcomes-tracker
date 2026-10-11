// v0.22 ?sort= URL deep-link verification. Mechanically extracts the
// SORTLINK-V22 block from js/app.js (no transcription) and unit-tests the
// pure helpers. Closes the v0.22 test-gap: the v0.22 commit and README claimed
// unit-testing in hidden_files/verify_sortlink_v22.js, but the file was never
// shipped (verified absent from every commit). This suite is the one v0.22
// described: parse table, URL-value table, round-trip over all 11 column keys
// x asc/desc — all pass.
// writeSortURL is intentionally excluded: it touches window/document and is
// not node-extractable.
const fs=require('fs');
const src=fs.readFileSync('/home/hatch/repos/university-outcomes-tracker/js/app.js','utf8');
const a=src.indexOf('// SORTLINK-V22-START'), b=src.indexOf('// SORTLINK-V22-END');
if(a<0||b<0) throw new Error('SORTLINK-V22 markers not found');
let block=src.slice(a,b);
const factory=new Function(block+'; return {SORTABLE_KEYS,SORT_PRESET_MAP,parseSortParam,sortParamValue};');
const {SORTABLE_KEYS,SORT_PRESET_MAP,parseSortParam,sortParamValue}=factory();

let pass=0,fail=0;
function ok(name,cond){ if(cond){pass++;}else{fail++;console.log('FAIL:',name);} }
const eq=(x,y)=>JSON.stringify(x)===JSON.stringify(y);

// ---- A. SORTABLE_KEYS inventory
const EXPECTED_KEYS=['name','conference','control','state','score','median_earn_10yr','endowment_per_student','grad_rate_6yr','loan_default','net_price_avg','enrollment_fte'];
ok('11 sortable keys',SORTABLE_KEYS.length===11);
ok('exact key set',eq(SORTABLE_KEYS,EXPECTED_KEYS));
ok('SORT_PRESET_MAP 4 presets',eq(Object.keys(SORT_PRESET_MAP).sort(),['earn_desc','endow_desc','grad_desc','score_desc']));
ok('preset entries are [key,dir]',eq(SORT_PRESET_MAP.earn_desc,['median_earn_10yr',-1])&&eq(SORT_PRESET_MAP.endow_desc,['endowment_per_student',-1])&&eq(SORT_PRESET_MAP.grad_desc,['grad_rate_6yr',-1])&&eq(SORT_PRESET_MAP.score_desc,['score',-1]));

// ---- B. parseSortParam: falsy -> null (default / unknown)
ok('parse null -> null',parseSortParam(null)===null);
ok('parse empty -> null',parseSortParam('')===null);
ok('parse undefined -> null',parseSortParam(undefined)===null);

// ---- C. parseSortParam: preset values
ok('parse score_desc',eq(parseSortParam('score_desc'),{key:'score',dir:-1,preset:'score_desc'}));
ok('parse earn_desc',eq(parseSortParam('earn_desc'),{key:'median_earn_10yr',dir:-1,preset:'earn_desc'}));
ok('parse endow_desc',eq(parseSortParam('endow_desc'),{key:'endowment_per_student',dir:-1,preset:'endow_desc'}));
ok('parse grad_desc',eq(parseSortParam('grad_desc'),{key:'grad_rate_6yr',dir:-1,preset:'grad_desc'}));
ok('parse value_desc (ROI/value preset)',eq(parseSortParam('value_desc'),{key:'value',dir:1,preset:'value_desc'}));

// ---- D. parseSortParam: generic <key>_asc|desc
ok('parse name_asc',eq(parseSortParam('name_asc'),{key:'name',dir:1,preset:'score_desc'}));
ok('parse median_earn_10yr_desc',eq(parseSortParam('median_earn_10yr_desc'),{key:'median_earn_10yr',dir:-1,preset:'score_desc'}));
ok('parse loan_default_asc',eq(parseSortParam('loan_default_asc'),{key:'loan_default',dir:1,preset:'score_desc'}));
ok('parse enrollment_fte_desc',eq(parseSortParam('enrollment_fte_desc'),{key:'enrollment_fte',dir:-1,preset:'score_desc'}));
ok('parse control_desc',eq(parseSortParam('control_desc'),{key:'control',dir:-1,preset:'score_desc'}));

// ---- E. parseSortParam: invalid -> null
ok('parse unknown key foo_desc -> null',parseSortParam('foo_desc')===null);
ok('parse bad suffix score_down -> null',parseSortParam('score_down')===null);
ok('parse trailing underscore name_ -> null',parseSortParam('name_')===null);
ok('parse case-sensitive Score_desc -> null',parseSortParam('Score_desc')===null);
ok('parse bare score -> null',parseSortParam('score')===null);
ok('parse extra suffix median_earn_10yr_desc_x -> null',parseSortParam('median_earn_10yr_desc_x')===null);
ok('parse double suffix name_asc_desc -> null (name_asc not a key)',parseSortParam('name_asc_desc')===null);

// ---- F. sortParamValue: defaults and presets
ok('value score/desc -> null (default omitted)',sortParamValue('score',-1,'score_desc')===null);
ok('value score/desc no preset -> null',sortParamValue('score',-1,undefined)===null);
ok('value score/asc -> score_asc',sortParamValue('score',1,'score_desc')==='score_asc');
ok('value preset earn_desc passes through',sortParamValue('median_earn_10yr',-1,'earn_desc')==='earn_desc');
ok('value preset endow_desc passes through',sortParamValue('endowment_per_student',-1,'endow_desc')==='endow_desc');
ok('value preset grad_desc passes through',sortParamValue('grad_rate_6yr',-1,'grad_desc')==='grad_desc');
ok('value preset value_desc passes through',sortParamValue('score',1,'value_desc')==='value_desc');
ok('value median_earn_10yr/desc -> median_earn_10yr_desc',sortParamValue('median_earn_10yr',-1,'score_desc')==='median_earn_10yr_desc');
ok('value name/asc -> name_asc',sortParamValue('name',1,'score_desc')==='name_asc');
ok('value unknown key -> null',sortParamValue('zzz',-1,'score_desc')===null);
ok('value unknown key with value_desc preset -> value_desc (preset wins)',sortParamValue('zzz',1,'value_desc')==='value_desc');

// ---- G. round-trip over all 11 keys x asc/desc (the v0.22 claim)
// null URL value is only legal for the default (score,-1); everything else
// must parse back to the original key+dir.
let rtN=0, rtFail=0;
for(const k of EXPECTED_KEYS){
  for(const d of [1,-1]){
    rtN++;
    const v=sortParamValue(k,d,'score_desc');
    if(v===null){
      if(!(k==='score'&&d===-1)){ rtFail++; console.log('FAIL: unexpected null value for',k,d); }
      else if(parseSortParam(v)!==null){ rtFail++; console.log('FAIL: null value must mean default for',k,d); }
    }else{
      const p=parseSortParam(v);
      if(!(p&&p.key===k&&p.dir===d)){ rtFail++; console.log('FAIL: round-trip broken for',k,d,'->',v,'->',JSON.stringify(p)); }
    }
  }
}
ok('round-trip 11 keys x asc/desc all pass',rtFail===0&&rtN===22);
const nullVals=EXPECTED_KEYS.flatMap(k=>[1,-1].map(d=>({k,d,v:sortParamValue(k,d,'score_desc')}))).filter(x=>x.v===null);
ok('only (score,-1) produces null',nullVals.length===1&&nullVals[0].k==='score'&&nullVals[0].d===-1);

// ---- H. preset round-trips. Note score_desc is the default state and is
// intentionally NOT encoded in the URL (null -> param omitted; init treats
// missing ?sort= as score/-1, and the preset select defaults to score_desc).
for(const preset of ['earn_desc','endow_desc','grad_desc']){
  const v=sortParamValue(SORT_PRESET_MAP[preset][0],SORT_PRESET_MAP[preset][1],preset);
  const p=parseSortParam(v);
  ok('preset round-trip '+preset,p&&p.preset===preset&&p.key===SORT_PRESET_MAP[preset][0]&&p.dir===SORT_PRESET_MAP[preset][1]);
}
ok('score_desc preset encodes as default (null -> param omitted)',
  sortParamValue('score',-1,'score_desc')===null&&parseSortParam(null)===null);
ok('value_desc round-trip',eq(parseSortParam(sortParamValue('score',1,'value_desc')),{key:'value',dir:1,preset:'value_desc'}));

// ---- I. determinism (pure functions)
ok('parse deterministic',eq(parseSortParam('name_asc'),parseSortParam('name_asc')));
ok('value deterministic',sortParamValue('name',1,'score_desc')===sortParamValue('name',1,'score_desc'));
ok('keys array not mutated by helpers',eq(SORTABLE_KEYS,EXPECTED_KEYS));

console.log(`sortlink_v22: ${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
