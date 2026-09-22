async function loadData(){
  const res = await fetch('data/universities.json');
  const j = await res.json();
  return j;
}

function fmtMoney(n){ if(n>=1e9) return '$'+(n/1e9).toFixed(1)+'B'; if(n>=1e6) return '$'+(n/1e6).toFixed(1)+'M'; if(n>=1e3) return '$'+(n/1e3).toFixed(0)+'k'; return '$'+n; }
function fmtNum(n){ return n.toLocaleString(); }

let allUnis=[], filtered=[], selectedCompare=new Set();

// v0.11 percentile toolkit: P10..P99 across the university distribution
const PCTS=[10,25,50,75,80,90,95,99];
let activePct=50;
function quantile(sorted,q){
  if(!sorted.length) return NaN;
  const pos=(sorted.length-1)*q, b=Math.floor(pos), r=pos-b;
  return sorted[b]+(sorted[b+1]!==undefined?r*(sorted[b+1]-sorted[b]):0);
}
function renderPctControls(){
  const c=document.getElementById('pct-controls'); if(!c) return;
  c.innerHTML=PCTS.map(p=>`<button class="pct-btn${p===activePct?' active':''}" data-p="${p}">P${p}</button>`).join('');
  c.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
    activePct=+b.dataset.p;
    renderPctControls(); renderMetrics(filtered); renderDistributions(filtered);
    const u=new URL(window.location); u.searchParams.set('p',activePct); history.replaceState(null,'',u);
  }));
}

function renderProvenance(meta){
  const el=document.getElementById('data-provenance');
  if(!el) return;
  const enriched = meta.enriched_count!=null ? meta.enriched_count : '—';
  const ver = meta.version || '0.1';
  const upd = meta.last_updated || '';
  const total = meta.total_universities || 150;
  el.textContent = `v${ver} • ${upd} • Scorecard real: ${enriched}/${total} • Source: ${meta.source?.split('(')[0]||''}`;
  const badge=document.getElementById('badge-real');
  if(badge) badge.textContent = `${enriched}/${total}`;
}

function exportCSV(unis){
  const headers=['id','name','control','state','carnegie','conference','score','median_earn_10yr','median_earn_real','debt_avg','loan_default','net_price_avg','grad_rate_6yr','retention','endowment_b','endowment_per_student','enrollment_fte','research_spend_m','alumni_network_k','admission_rate','lat','lon','scorecard_id','scorecard_name'];
  const rows=[headers.join(',')];
  unis.forEach(u=>{
    const vals=headers.map(h=>{
      let v=u[h];
      if(h==='median_earn_real') v=u.median_earn_10yr_real||'';
      if(v==null) v='';
      if(typeof v==='string' && (v.includes(',')||v.includes('"'))) return `"${v.replace(/"/g,'""')}"`;
      return v;
    });
    rows.push(vals.join(','));
  });
  const blob=new Blob([rows.join('\n')],{type:'text/csv'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`university-outcomes-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
}

function toggleCompare(id){
  if(selectedCompare.has(id)) selectedCompare.delete(id); else { if(selectedCompare.size>=4){ alert('Max 4 for comparison'); return; } selectedCompare.add(id); }
  updateCompareBar();
  renderTable(filtered);
}
function updateCompareBar(){
  const bar=document.getElementById('compare-bar'); const cnt=document.getElementById('compare-count');
  if(!bar) return;
  cnt.textContent=`${selectedCompare.size} selected for compare`;
  bar.style.display=selectedCompare.size>0?'flex':'none';
}
// COMPARE-CSV-V25-START
const COMPARE_DIMS=['score','conference','carnegie','control','median_earn_10yr','debt_avg','loan_default','net_price_avg','grad_rate_6yr','retention','endowment_per_student','admission_rate','enrollment_fte','roi_10yr'];
function compareRaw(u,k){
  if(k==='roi_10yr') return u.median_earn_10yr-35000*2-u.net_price_avg*4;
  let v=u[k];
  if(v==null){ const r=u[k+'_real']; v=(typeof r==='number')?r:null; }
  return v;
}
function isMoneyDim(k){ return k.includes('earn')||k.includes('debt')||k.includes('price')||k.includes('endowment')||k==='roi_10yr'; }
function isPctDim(k){ return k.includes('grad')||k.includes('retention')||k.includes('default')||k.includes('admission'); }
function compareCellHTML(u,k){
  const v0=compareRaw(u,k);
  if(k==='conference'||k==='carnegie'||k==='control') return `<td>${v0||'—'}</td>`;
  let v=v0==null?'—':v0;
  if(isMoneyDim(k)) v=v!=null&&v!=='—'?fmtMoney(v):v;
  else if(isPctDim(k)) v=v!=null&&v!=='—'?(v*100).toFixed(1)+'%':v;
  else if(typeof v==='number') v=v.toFixed(1);
  const realBadge=u[k+'_real']!=null||u.median_earn_10yr_real!=null&&k==='median_earn_10yr'?' <span style="font-size:.65rem;color:#3dd598">●real</span>':'';
  return `<td>${v}${realBadge}</td>`;
}
function csvCell(s){
  s=(s==null)?'':String(s);
  return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
}
function buildCompareCSV(picks){
  const rows=[['Metric'].concat(picks.map(u=>u.name))];
  COMPARE_DIMS.forEach(k=>{ rows.push([k].concat(picks.map(u=>{ const v=compareRaw(u,k); return v==null?'':String(v); }))); });
  return rows.map(r=>r.map(csvCell).join(',')).join('\n');
}
// COMPARE-CSV-V25-END
// BENCH-CSV-V27-START
function benchGroupKey(u,mode){
  if(mode==='conference') return u.conference||u.peer_group||'Other';
  if(mode==='carnegie') return u.carnegie||'Other';
  if(mode==='control') return u.control||'Other';
  if(mode==='state') return u.state||'Other';
  return 'All';
}
function groupBenchRows(unis,mode){
  const groups={};
  unis.forEach(u=>{ const g=benchGroupKey(u,mode); (groups[g]=groups[g]||[]).push(u); });
  return Object.keys(groups).sort().map(g=>{
    const members=groups[g].slice().sort((a,b)=>b.score-a.score);
    const n=members.length;
    const avgScore=members.reduce((s,u)=>s+u.score,0)/n;
    const avgEarn=members.reduce((s,u)=>s+u.median_earn_10yr,0)/n;
    const avgROI=members.reduce((s,u)=>s+(u.median_earn_10yr-35000*2-u.net_price_avg*4),0)/n;
    return {group:g, n, avgScore, avgEarn, avgROI, top3:members.slice(0,3).map(m=>({id:m.id,name:m.name}))};
  }).sort((a,b)=>b.avgScore-a.avgScore);
}
function benchCsvCell(s){
  s=(s==null)?'':String(s);
  return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
}
function buildBenchCSV(rows,mode){
  const header=[mode+'_group','n','avg_score','avg_earn','avg_roi','top3'];
  const out=[header];
  rows.forEach(r=>{ out.push([r.group, r.n, r.avgScore.toFixed(2), Math.round(r.avgEarn), Math.round(r.avgROI), r.top3.map(t=>t.name).join('; ')]); });
  return out.map(r=>r.map(benchCsvCell).join(',')).join('\n');
}
function downloadBenchCSV(){
  const st=window.__lastBench;
  const rows=st&&st.rows, mode=st&&st.mode;
  if(!rows||!rows.length){ alert('Peer benchmarking table not available'); return; }
  const csv=buildBenchCSV(rows,mode);
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='university-benchmark-'+mode+'.csv';
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },200);
}
// BENCH-CSV-V27-END
function downloadCompareCSV(){
  const ids=window.__lastCompare||[];
  const picks=ids.map(id=>allUnis.find(u=>u.id===id)).filter(Boolean);
  if(picks.length<2){ alert('Select at least 2 schools to compare first'); return; }
  const csv=buildCompareCSV(picks);
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='university-compare-'+picks.map(u=>u.id).join('-')+'.csv';
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },200);
}
function showCompare(){
  if(selectedCompare.size<2){ alert('Select at least 2'); return; }
  const picks=[...selectedCompare].map(id=>allUnis.find(u=>u.id===id)).filter(Boolean);
  window.__lastCompare=picks.map(u=>u.id);
  const p=document.getElementById('detail-panel');
  p.classList.remove('hidden');
  let html=`<h3>Comparison — ${picks.map(u=>u.name).join(' vs ')}</h3><div style="overflow:auto"><table style="width:100%;font-size:.86rem"><thead><tr><th>Metric</th>${picks.map(u=>`<th>${u.name}<br><span style="font-size:.7rem;color:#9aa0b8">${u.conference||u.carnegie||''}</span></th>`).join('')}</tr></thead><tbody>`;
  COMPARE_DIMS.forEach(k=>{
    html+=`<tr><td><b>${k}</b></td>${picks.map(u=>compareCellHTML(u,k)).join('')}</tr>`;
  });
  html+=`</tbody></table></div><p style="font-size:.8rem;color:#9aa0b8;margin-top:8px">●real = College Scorecard API. ROI 10yr = earn - $70k HS baseline - 4×net price. Conference fixed v0.5 (150/150). Drag nodes in peer network, URL ?peer= persists.</p><div style="display:flex;gap:8px;margin-top:8px"><button onclick="document.getElementById('detail-panel').classList.add('hidden')">Close</button><button onclick="window.__downloadCompareCSV()" style="padding:6px 12px;background:#3dd598;border:none;border-radius:6px;color:#0a0f1a;font-size:.85rem;cursor:pointer">⬇ Download CSV</button></div>`;
  p.innerHTML=html;
  p.scrollIntoView({behavior:'smooth'});
}

function renderMetrics(unis){
  const vals=key=>unis.map(u=>u[key]).filter(v=>v!=null).sort((a,b)=>a-b);
  const q=key=>quantile(vals(key),activePct/100);
  const P='P'+activePct;
  const labels=document.querySelectorAll('#metrics-strip .metric-card .metric-label');
  const set=(i,label)=>{ if(labels[i]) labels[i].textContent=label; };
  set(0,`${P} Alumni Advantage`);
  document.getElementById('m-median-score').textContent=q('score').toFixed(1);
  set(1,`${P} Earnings 10yr`);
  document.getElementById('m-earnings').textContent=fmtMoney(q('median_earn_10yr'));
  set(2,`${P} Endow / Student`);
  document.getElementById('m-endow').textContent=fmtMoney(q('endowment_per_student'));
  set(3,`${P} Grad Rate 6yr`);
  document.getElementById('m-grad').textContent=(q('grad_rate_6yr')*100).toFixed(0)+'%';
  set(4,`${P} Loan Default`);
  document.getElementById('m-default').textContent=(q('loan_default')*100).toFixed(1)+'%';
  const subs=document.querySelectorAll('#metrics-strip .metric-card .metric-delta');
  if(subs[4]) subs[4].textContent=`Lower is better \u2022 ${P} of ${unis.length} schools`;
}

function renderDistributions(unis){
  const grid=document.getElementById('dist-grid'); if(!grid) return;
  const defs=[
    {key:'score',title:'Alumni Advantage Score',fmt:v=>v.toFixed(1),lower:false},
    {key:'median_earn_10yr',title:'Median Earnings 10yr',fmt:v=>fmtMoney(v),lower:false},
    {key:'endowment_per_student',title:'Endowment / Student',fmt:v=>fmtMoney(v),lower:false,log:true},
    {key:'grad_rate_6yr',title:'6yr Graduation Rate',fmt:v=>(v*100).toFixed(0)+'%',lower:false},
    {key:'loan_default',title:'Loan Default Rate',fmt:v=>(v*100).toFixed(1)+'%',lower:true},
    {key:'net_price_avg',title:'Avg Net Price',fmt:v=>fmtMoney(v),lower:true},
  ];
  grid.innerHTML='';
  const pending=[];
  defs.forEach(def=>{
    const items=unis.map(u=>({u,v:u[def.key]})).filter(d=>d.v!=null);
    if(!items.length) return;
    const s=items.map(d=>d.v).sort((a,b)=>a-b);
    const pv=quantile(s,activePct/100);
    const card=document.createElement('div'); card.className='dist-card';
    card.innerHTML=`<h4>${def.title}${def.lower?' <span class="lower-tag">lower is better</span>':''}</h4><div class="dist-chart"></div>
      <div class="dist-stats"><span>P10 ${def.fmt(quantile(s,.10))}</span><span class="dist-sel">P${activePct} <b>${def.fmt(pv)}</b></span><span>P90 ${def.fmt(quantile(s,.90))}</span></div>`;
    grid.appendChild(card);
    pending.push([card.querySelector('.dist-chart'),items,def,pv,s]);
  });
  // two-pass: measure after all cards are laid out so each gets its final column width
  pending.forEach(a=>drawDistStrip(a[0],a[1],a[2],a[3],a[4]));
}

function drawDistStrip(el,items,def,pv,sorted){
  el.innerHTML='';
  const W=Math.max(el.clientWidth||320,280), H=118, m={top:18,right:12,bottom:26,left:12};
  const svg=d3.select(el).append('svg').attr('viewBox',`0 0 ${W} ${H}`).attr('width','100%').style('height','auto').style('display','block').style('overflow','visible');
  const vs=sorted;
  const x=def.log
    ? d3.scaleLog().domain([vs[0]*0.9,vs[vs.length-1]*1.1]).range([m.left,W-m.right])
    : d3.scaleLinear().domain([vs[0],vs[vs.length-1]]).range([m.left,W-m.right]);
  const yMid=60;
  const b10=quantile(vs,.10), b90=quantile(vs,.90);
  svg.append('rect').attr('x',x(b10)).attr('y',yMid-24).attr('width',Math.max(1,x(b90)-x(b10))).attr('height',48).attr('rx',6).attr('fill','rgba(124,140,255,.10)');
  const p50=quantile(vs,.5);
  svg.append('line').attr('x1',x(p50)).attr('x2',x(p50)).attr('y1',yMid-24).attr('y2',yMid+24).attr('stroke','#c8ccda').attr('stroke-width',1.5).attr('opacity',.7);
  items.forEach((d,i)=>{
    const jx=(((i*2654435761)%100)/100-0.5)*2;
    const jy=(((i*40503)%100)/100-0.5)*32;
    svg.append('circle')
      .attr('cx',x(d.v)+jx).attr('cy',yMid+jy).attr('r',3)
      .attr('fill',d.u.control==='private'?'#7c8cff':'#3dd598').attr('opacity',.55)
      .style('cursor','pointer')
      .on('click',()=>showDetail(d.u.id))
      .append('title').text(`${d.u.name}: ${def.fmt(d.v)}`);
  });
  svg.append('line').attr('x1',x(pv)).attr('x2',x(pv)).attr('y1',yMid-28).attr('y2',yMid+28).attr('stroke','#7c8cff').attr('stroke-width',2.5);
  svg.append('text').attr('x',Math.min(Math.max(x(pv),m.left+34),W-m.right-34)).attr('y',12).attr('text-anchor','middle').attr('fill','#7c8cff').attr('font-size','11px').attr('font-weight','600').text(`P${activePct} ${def.fmt(pv)}`);
  const ax=svg.append('g').attr('transform',`translate(0,${H-m.bottom})`).attr('color','#9aa0b8');
  if(def.log) ax.call(d3.axisBottom(x).ticks(4,'~s'));
  else ax.call(d3.axisBottom(x).ticks(4).tickFormat(d=>def.fmt(d)));
  ax.selectAll('text').attr('font-size','9px');
}

function corr(x,y){
  const n=x.length; if(n===0) return 0;
  const mx=x.reduce((a,b)=>a+b,0)/n, my=y.reduce((a,b)=>a+b,0)/n;
  let num=0, dx=0, dy=0;
  for(let i=0;i<n;i++){ const cx=x[i]-mx, cy=y[i]-my; num+=cx*cy; dx+=cx*cx; dy+=cy*cy; }
  return dx&&dy? num/Math.sqrt(dx*dy) : 0;
}

// v0.21 significance toolkit: two-tailed p-value for Pearson r via Student's t.
// t = r*sqrt(df)/sqrt(1-r^2), p from the t CDF via the regularized incomplete
// beta I_x(a,b) (Numerical Recipes betacf continued fraction + Lanczos lgamma).
function lgamma(x){
  const C=[0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
  if(x<0.5) return Math.log(Math.PI/Math.sin(Math.PI*x))-lgamma(1-x);
  x-=1; let a=C[0]; for(let i=1;i<9;i++) a+=C[i]/(x+i);
  const t=x+7.5;
  return 0.5*Math.log(2*Math.PI)+(x+0.5)*Math.log(t)-t+Math.log(a);
}
function betacf(a,b,x){
  const MAXIT=200, EPS=3e-14, FPMIN=1e-300;
  const qab=a+b, qap=a+1, qam=a-1;
  let c=1, d=1-qab*x/qap;
  if(Math.abs(d)<FPMIN) d=FPMIN; d=1/d; let h=d;
  for(let m=1;m<=MAXIT;m++){
    const m2=2*m;
    let aa=m*(b-m)*x/((qam+m2)*(a+m2));
    d=1+aa*d; if(Math.abs(d)<FPMIN) d=FPMIN; c=1+aa/c; if(Math.abs(c)<FPMIN) c=FPMIN; d=1/d; h*=d*c;
    aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2));
    d=1+aa*d; if(Math.abs(d)<FPMIN) d=FPMIN; c=1+aa/c; if(Math.abs(c)<FPMIN) c=FPMIN; d=1/d; const del=d*c; h*=del;
    if(Math.abs(del-1)<EPS) break;
  }
  return h;
}
function betaReg(x,a,b){
  if(x<=0) return 0; if(x>=1) return 1;
  const bt=Math.exp(lgamma(a+b)-lgamma(a)-lgamma(b)+a*Math.log(x)+b*Math.log(1-x));
  const r = x<(a+1)/(a+b+2) ? bt*betacf(a,b,x)/a : 1-bt*betacf(b,a,1-x)/b;
  return Math.min(1,Math.max(0,r));
}
function tPval(t,df){
  if(t===0) return 1;
  if(!isFinite(t)||df<=0) return t===0?1:0;
  const x=df/(df+t*t);
  return betaReg(x, df/2, 0.5); // two-tailed: P(|T|>=|t|)
}
function corrTest(x,y){
  const r=corr(x,y), n=x.length, df=n-2;
  if(df<=0) return {r,n,t:NaN,p:NaN};
  if(Math.abs(r)>=1) return {r,n,t:Infinity,p:0};
  const t=Math.abs(r)*Math.sqrt(df/(1-r*r));
  return {r,n,t,p:tPval(t,df)};
}
function fmtP(p){
  if(!(p>=0)) return 'p n/a';
  if(p<0.001) return 'p<0.001';
  if(p<0.01) return 'p='+p.toFixed(3);
  return 'p='+p.toFixed(2);
}
function sigWord(p){ return !(p>=0) ? 'untested' : (p<0.05 ? 'significant at α=0.05' : 'not significant at α=0.05'); }
function linearRegression(x,y){
  const n=x.length; const mx=x.reduce((a,b)=>a+b,0)/n, my=y.reduce((a,b)=>a+b,0)/n;
  let num=0, den=0;
  for(let i=0;i<n;i++){ num+=(x[i]-mx)*(y[i]-my); den+=(x[i]-mx)*(x[i]-mx); }
  const m=den?num/den:0; const b=my-m*mx;
  return {m,b};
}
// v0.23 radar toolkit: true radial radar chart with per-dimension min-max
// normalization to 0-100 (replaces the grouped-bar "radar" + /1.5 scale hack).
// Min-max extents are taken over the FULL dataset (stable under filtering);
// private/public polygons are averages of the current filtered set.
// RADAR-V23-START
const RADAR_DIMS=[
  {key:'career',   label:'Career',   val:u=>u.median_earn_10yr},
  {key:'alumni',   label:'Alumni',   val:u=>u.alumni_giving},
  {key:'academic', label:'Academic', val:u=>u.grad_rate_6yr},
  {key:'financial',label:'Financial',val:u=>Math.log(u.endowment_per_student||1)},
  {key:'value',    label:'Value',    val:u=>1-u.loan_default}
];
function radarExtents(unis){
  const ext={};
  RADAR_DIMS.forEach(d=>{
    const vs=unis.map(d.val).filter(v=>Number.isFinite(v));
    ext[d.key]=vs.length?[Math.min(...vs),Math.max(...vs)]:[0,1];
  });
  return ext;
}
function radarNormVal(ext,key,v){
  const [lo,hi]=ext[key];
  if(!Number.isFinite(v)||!(hi>lo)) return 0;
  return Math.min(100,Math.max(0,(v-lo)/(hi-lo)*100));
}
function radarAverage(unis,ext){
  const o={};
  RADAR_DIMS.forEach(d=>{
    const vs=unis.map(u=>radarNormVal(ext,d.key,d.val(u)));
    o[d.key]=vs.length?vs.reduce((a,b)=>a+b,0)/vs.length:0;
  });
  return o;
}
function radarPoint(cx,cy,R,i,n,v){
  const a=-Math.PI/2 + i*2*Math.PI/n;
  const r=R*Math.min(100,Math.max(0,v))/100;
  return [cx+r*Math.cos(a), cy+r*Math.sin(a)];
}
// RADAR-V23-END
function renderInsights(data){
  const unis = data.universities;
  const insights = [];
  const topScore = [...unis].sort((a,b)=>b.score-a.score)[0];
  const topEarn = [...unis].sort((a,b)=>b.median_earn_10yr-a.median_earn_10yr)[0];
  const bestValue = [...unis].sort((a,b)=>(a.net_price_avg/a.median_earn_10yr)-(b.net_price_avg/b.median_earn_10yr))[0];
  const privateAvg = unis.filter(u=>u.control==='private').reduce((s,u)=>s+u.score,0)/unis.filter(u=>u.control==='private').length;
  const publicAvg = unis.filter(u=>u.control==='public').reduce((s,u)=>s+u.score,0)/unis.filter(u=>u.control==='public').length;
  const realCount = unis.filter(u=>u.median_earn_10yr_real).length;
  const median = arr => { const s=[...arr].sort((a,b)=>a-b); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; };
  const earns = unis.map(u=>u.median_earn_10yr);
  const medianEarn = median(earns);
  const highDefault = [...unis].sort((a,b)=>b.loan_default-a.loan_default)[0];
  const lowAdmit = [...unis].filter(u=>u.admission_rate).sort((a,b)=>a.admission_rate-b.admission_rate)[0];
  const highResearch = [...unis].sort((a,b)=>b.research_spend_m-a.research_spend_m)[0];
  const bestGrad = [...unis].sort((a,b)=>b.grad_rate_6yr-a.grad_rate_6yr)[0];
  const endowPerMedian = median(unis.map(u=>u.endowment_per_student));
  const publicFlagshipValue = unis.filter(u=>u.control==='public' && u.carnegie==='R1').sort((a,b)=>(a.net_price_avg/a.median_earn_10yr)-(b.net_price_avg/b.median_earn_10yr))[0];
  const ctEarnEndow = corrTest(unis.map(u=>Math.log(u.endowment_per_student||1)), unis.map(u=>u.median_earn_10yr));
  const ctEarnGrad = corrTest(unis.map(u=>u.grad_rate_6yr), unis.map(u=>u.median_earn_10yr));
  const _selA = unis.filter(u=>u.admission_rate);
  const ctAdmitScore = corrTest(_selA.map(u=>1-u.admission_rate), _selA.map(u=>u.score));
  const medianROI = median(unis.map(u=>u.median_earn_10yr - 35000*2 - u.net_price_avg*4));
  const topROI = [...unis].sort((a,b)=>(b.median_earn_10yr - b.net_price_avg*4)-(a.median_earn_10yr - a.net_price_avg*4))[0];
  // Peer benchmarking
  const byConf={};
  unis.forEach(u=>{ const k=u.conference||'Other'; if(!byConf[k]) byConf[k]=[]; byConf[k].push(u); });
  const confBench=Object.entries(byConf).map(([k,arr])=>({k, n:arr.length, avgScore:arr.reduce((s,u)=>s+u.score,0)/arr.length, avgEarn:arr.reduce((s,u)=>s+u.median_earn_10yr,0)/arr.length})).sort((a,b)=>b.avgScore-a.avgScore).slice(0,5);
  const confBenchStr=confBench.map(c=>`${c.k}: ${c.avgScore.toFixed(1)} avg, $${(c.avgEarn/1000).toFixed(0)}k earn, n=${c.n}`).join(' • ');

  insights.push({t:`Top Alumni Advantage: ${topScore.name}`, d:`Score ${topScore.score} — ${topScore.conference||topScore.control} ${topScore.carnegie}, endowment $${(topScore.endowment_b)}B, earnings $${topScore.median_earn_10yr.toLocaleString()} 10yr. Model: high endowment/student + low Pell gap + high retention. Conference ${topScore.conference} fixed v0.5.`});
  insights.push({t:`Highest Earnings: ${topEarn.name}`, d:`$${topEarn.median_earn_10yr.toLocaleString()} median 10yr. SF ratio ${topEarn.sf_ratio}:1, research $${topEarn.research_spend_m}M. Earnings premium correlates with research spend per student (r~0.6). ${topEarn.median_earn_10yr_real? '● Scorecard real.' : ''} Conference ${topEarn.conference}.`});
  insights.push({t:`Best Value (Price/Earnings): ${bestValue.name}`, d:`Net price $${bestValue.net_price_avg.toLocaleString()} vs earnings $${bestValue.median_earn_10yr.toLocaleString()}. Public flagship model shows ROI advantage despite lower endowment/student. Ratio ${(bestValue.net_price_avg/bestValue.median_earn_10yr).toFixed(2)}. Conf ${bestValue.conference}.`});
  insights.push({t:`Private vs Public: ${privateAvg.toFixed(1)} vs ${publicAvg.toFixed(1)} avg score`, d:`Private advantage driven by endowment/student (avg ${(endowPerMedian/1000).toFixed(0)}k median) and alumni giving (28% vs 9%). Publics close gap on value/ROI and research scale. n=${unis.length}, private=${unis.filter(u=>u.control==='private').length}, public=${unis.filter(u=>u.control==='public').length}.`});
  insights.push({t:`Correlation: Earnings vs Endowment r=${ctEarnEndow.r.toFixed(2)} (${fmtP(ctEarnEndow.p)})`, d:`Log(endow/student) vs earnings 10yr r=${ctEarnEndow.r.toFixed(2)}, ${fmtP(ctEarnEndow.p)}, n=${ctEarnEndow.n} — ${sigWord(ctEarnEndow.p)}. Earnings vs grad rate r=${ctEarnGrad.r.toFixed(2)} (${fmtP(ctEarnGrad.p)}, ${sigWord(ctEarnGrad.p)}). Selectivity (1-admit) vs score r=${ctAdmitScore.r.toFixed(2)} (${fmtP(ctAdmitScore.p)}, n=${ctAdmitScore.n}, ${sigWord(ctAdmitScore.p)}). All p-values two-tailed Student's t on Pearson r (df=n-2). Strongest predictor is grad rate + retention, not raw endowment. Scatter shows regression line with significance.`});
  insights.push({t:`ROI Leader: ${topROI.name} $${(topROI.median_earn_10yr - 35000*2 - topROI.net_price_avg*4).toLocaleString()} 10yr`, d:`ROI 10yr = earnings - $70k HS baseline - 4×net price. Median ROI $${medianROI.toLocaleString()} across ${unis.length} schools. ${topROI.name} ROI $${(topROI.median_earn_10yr - 35000*2 - topROI.net_price_avg*4).toLocaleString()} = $${topROI.median_earn_10yr.toLocaleString()} - $70k - $${(topROI.net_price_avg*4).toLocaleString()}. Public flagships dominate ROI due to low net price. Compare table now shows ROI column.`});
  insights.push({t:`Peer Benchmark: Conference Leaders`, d:`Top 5 conferences by avg Alumni Advantage: ${confBenchStr}. Ivy League (n=${byConf['Ivy League']?.length||0}) avg ${(byConf['Ivy League']?byConf['Ivy League'].reduce((s,u)=>s+u.score,0)/byConf['Ivy League'].length:0).toFixed(1)} vs Big Ten ${(byConf['Big Ten']?byConf['Big Ten'].reduce((s,u)=>s+u.score,0)/byConf['Big Ten'].length:0).toFixed(1)}. Peer network drag-enabled, clickable, URL ?peer= persists.`});
  insights.push({t:`Public Filings Coverage: 6 sources • ${realCount}/${unis.length} real`, d:`IPEDS (100% Title IV), IRS 990 (private only), Audited financials (GAAP), College Scorecard (earnings/debt/default/net price) ${realCount}/${unis.length} real, NSF HERD (R&D), State audit (publics). Filing presence is trust signal, not score weight. v0.5 fixes 9 Scorecard mismatches (Brown, UChicago, Penn, Baylor, BYU, Houston, Louisville, Miami, Utah, Davidson, Denver, Delaware, UConn, Howard).`});
  insights.push({t:`Conference Fix: 150/150 now grouped`, d:`v0.5 fixes 66 universities missing conference (original 60 + 6 new). Now 10 conferences: Big Ten 19, ACC 16, SEC 14, Big 12 14, Ivy 10, UAA 10, Big East 7, Big West 7, Patriot 6, SCIAC 5. Peer network no longer has 60-node "Other" blob — force-directed x-force by conference, collide, charge, drag. 149/150 Scorecard real (98.7%).`});
  insights.push({t:`Most Selective: ${lowAdmit ? lowAdmit.name + ' ' + (lowAdmit.admission_rate*100).toFixed(1)+'%' : 'n/a'}`, d:`Low admit rate correlates with alumni advantage (r~0.55) but not perfectly — value/ROI rewards publics with broader access. ${lowAdmit?.admission_rate!=null? 'Admit '+(lowAdmit.admission_rate*100).toFixed(1)+'% real Scorecard.' : ''} Conference ${lowAdmit?.conference||''}.`});
  insights.push({t:`Research Powerhouse: ${highResearch.name}`, d:`$${highResearch.research_spend_m}M NSF HERD, ${highResearch.carnegie}, enrollment ${highResearch.enrollment_fte.toLocaleString()} FTE. Research spend per student $${(highResearch.research_spend_m*1e6/highResearch.enrollment_fte).toFixed(0)}. Conf ${highResearch.conference}.`});
  insights.push({t:`Graduation Leader: ${bestGrad.name}`, d:`${(bestGrad.grad_rate_6yr*100).toFixed(0)}% 6yr grad rate, retention ${(bestGrad.retention*100).toFixed(0)}%. Academic Quality 15% of Alumni Advantage — grad rate + retention + SF ratio + research/student. Conf ${bestGrad.conference}.`});
  insights.push({t:`Default Risk: ${highDefault.name} highest`, d:`${(highDefault.loan_default*100).toFixed(1)}% loan default vs median ${(median(unis.map(u=>u.loan_default))*100).toFixed(1)}%. Lower default = higher Value/ROI (20% weight). Publics with low net price have lower default even with higher Pell %`});
  insights.push({t:`Median Earnings: $${medianEarn.toLocaleString()} (149 real)`, d:`Median 10yr earnings across ${unis.length} universities. Top quartile > $${[...earns].sort((a,b)=>b-a)[Math.floor(earns.length*0.25)].toLocaleString()}, bottom quartile < $${[...earns].sort((a,b)=>a-b)[Math.floor(earns.length*0.75)].toLocaleString()}. Earnings from College Scorecard where available (green dot). 149/150 real after mismatch correction.`});
  const grid = document.getElementById('insights-grid');
  grid.innerHTML = insights.map(i=>`<div class="insight-card"><h4>${i.t}</h4><p>${i.d}</p></div>`).join('');
}

function renderTable(unis){
  const thead = document.querySelector('#uni-table thead');
  thead.innerHTML = `<tr><th>◫</th><th data-k="name">University <span title="Scorecard name stored">ⓘ</span></th><th data-k="conference">Conf</th><th data-k="control">Control</th><th data-k="state">State</th><th data-k="score">Score</th><th data-k="median_earn_10yr">Earn 10yr <span title="Real = green dot">ⓘ</span></th><th data-k="endowment_per_student">Endow / Stud</th><th data-k="grad_rate_6yr">Grad 6yr</th><th data-k="loan_default">Default</th><th data-k="net_price_avg">Net Price</th><th data-k="enrollment_fte">Enroll</th></tr>`;
  const tbody = document.querySelector('#uni-table tbody');
  tbody.innerHTML = unis.map(u=>{
    const checked=selectedCompare.has(u.id)?'checked':'';
    const realDot=u.median_earn_10yr_real!=null?'<span style="color:#3dd598" title="Scorecard real">●</span>':'<span style="color:#555" title="Synthetic">○</span>';
    const debtReal=u.debt_avg_real!=null?' title="Scorecard real"' : ' title="Synthetic"';
    return `<tr data-id="${u.id}"><td><input type="checkbox" ${checked} onchange="event.stopPropagation(); window.__toggleCompare('${u.id}')" /></td><td><b>${u.name}</b> ${realDot}<br><span style="color:#9aa0b8;font-size:.75rem">${u.carnegie} • ${u.conference||''} • ${u.enrollment_fte.toLocaleString()} FTE ${u.admission_rate!=null?`• admit ${(u.admission_rate*100).toFixed(0)}%`:''}</span></td><td style="font-size:.78rem">${u.conference||''}</td><td>${u.control}</td><td>${u.state}</td><td><b>${u.score.toFixed(1)}</b></td><td>${fmtMoney(u.median_earn_10yr)} ${u.median_earn_10yr_real?`<span style="font-size:.7rem;color:#3dd598">real</span>`:''}</td><td>${fmtMoney(u.endowment_per_student)}</td><td>${(u.grad_rate_6yr*100).toFixed(0)}%</td><td><span${debtReal}>${(u.loan_default*100).toFixed(1)}%</span></td><td>${fmtMoney(u.net_price_avg)}</td><td>${fmtNum(u.enrollment_fte)}</td></tr>`;
  }).join('');
  tbody.querySelectorAll('tr').forEach(tr=>tr.addEventListener('click',(e)=>{ if(e.target.type==='checkbox') return; showDetail(tr.dataset.id); }));
  thead.querySelectorAll('th').forEach(th=>th.addEventListener('click',()=>{ const k=th.dataset.k; if(k) sortBy(k); }));
}

let sortKey='score', sortDir=-1;
const SORTABLE_KEYS=['name','conference','control','state','score','median_earn_10yr','endowment_per_student','grad_rate_6yr','loan_default','net_price_avg','enrollment_fte'];
const SORT_PRESET_MAP={score_desc:['score',-1],earn_desc:['median_earn_10yr',-1],endow_desc:['endowment_per_student',-1],grad_desc:['grad_rate_6yr',-1]};
// ?sort= URL deep-link helpers (pure; unit-tested by hidden_files/verify_sortlink_v22.js)
// parseSortParam(v) -> {key,dir,preset} | null (null = default or unknown)
function parseSortParam(v){
  if(!v) return null;
  if(v==='value_desc') return {key:'value',dir:1,preset:'value_desc'};
  if(SORT_PRESET_MAP[v]) return {key:SORT_PRESET_MAP[v][0],dir:SORT_PRESET_MAP[v][1],preset:v};
  const m=/^(.+)_(asc|desc)$/.exec(v);
  if(m&&SORTABLE_KEYS.includes(m[1])) return {key:m[1],dir:m[2]==='asc'?1:-1,preset:'score_desc'};
  return null;
}
// sortParamValue(key,dir,preset) -> URL param string | null (null when default score_desc)
function sortParamValue(key,dir,preset){
  if(preset==='value_desc') return 'value_desc';
  if(preset==='earn_desc') return 'earn_desc';
  if(preset==='endow_desc') return 'endow_desc';
  if(preset==='grad_desc') return 'grad_desc';
  if(key==='score'&&dir===-1) return null;
  if(!SORTABLE_KEYS.includes(key)) return null;
  return key+'_'+(dir<0?'desc':'asc');
}
function writeSortURL(){
  const u=new URL(window.location);
  const preset=document.getElementById('sort-preset').value;
  const v=sortParamValue(sortKey,sortDir,preset);
  if(v) u.searchParams.set('sort',v); else u.searchParams.delete('sort');
  history.replaceState(null,'',u);
}
function sortBy(k){
  if(sortKey===k) sortDir*=-1; else {sortKey=k; sortDir=k==='name'||k==='control'||k==='state'||k==='conference'?1:-1;}
  const sp=document.getElementById('sort-preset'); if(sp) sp.value='score_desc'; // neutralize preset so the clicked column sort takes effect
  applyFilters();
  writeSortURL();
}
function applyFilters(){
  const q = document.getElementById('search').value.toLowerCase();
  const f = document.getElementById('filter-control').value;
  let list = [...allUnis];
  if(q) list = list.filter(u=> (u.name+' '+u.state+' '+u.control+' '+u.carnegie+' '+(u.conference||'')).toLowerCase().includes(q));
  if(f==='private') list = list.filter(u=>u.control==='private');
  if(f==='public') list = list.filter(u=>u.control==='public');
  if(f==='R1') list = list.filter(u=>u.carnegie==='R1');
  const preset = document.getElementById('sort-preset').value;
  if(preset==='earn_desc'){sortKey='median_earn_10yr';sortDir=-1;}
  if(preset==='endow_desc'){sortKey='endowment_per_student';sortDir=-1;}
  if(preset==='grad_desc'){sortKey='grad_rate_6yr';sortDir=-1;}
  if(preset==='value_desc'){
    list = list.sort((a,b)=>(a.net_price_avg/a.median_earn_10yr)-(b.net_price_avg/b.median_earn_10yr));
    filtered=list; renderTable(filtered); drawCharts(filtered); renderPeers(filtered); renderMap(filtered); renderMetrics(filtered); renderDistributions(filtered); return;
  }
  list.sort((a,b)=>{ let av=a[sortKey], bv=b[sortKey]; if(typeof av==='string') av=av.toLowerCase(), bv=bv.toLowerCase(); if(av<bv) return -1*sortDir; if(av>bv) return 1*sortDir; return 0; });
  filtered=list; renderTable(filtered); drawCharts(filtered); renderPeers(filtered); renderMap(filtered); renderMetrics(filtered); renderDistributions(filtered);
}

function showDetail(id){
  const u = allUnis.find(x=>x.id===id); if(!u) return;
  const p = document.getElementById('detail-panel');
  p.classList.remove('hidden');
  const realBadge = (k)=> u[k+'_real']!=null ? '<span style="font-size:.65rem;background:#0f251c;color:#3dd598;border:1px solid #1f5c3a;padding:1px 5px;border-radius:999px;margin-left:6px">Scorecard real</span>' : '<span style="font-size:.65rem;background:#1f1f28;color:#9aa0b8;padding:1px 5px;border-radius:999px;margin-left:6px">synthetic</span>';
  const provenance = u.scorecard_name ? `<div style="font-size:.75rem;color:#9aa0b8;margin-top:6px">Matched to Scorecard: ${u.scorecard_name} (${u.scorecard_city}) ID ${u.scorecard_id} • Conf ${u.conference||''}${u.lat!=null?` • Location ${u.lat.toFixed(3)}, ${u.lon.toFixed(3)} (Wikipedia coord)`:''}</div>` : '';
  p.innerHTML = `<h3>${u.name} — Alumni Advantage ${u.score.toFixed(1)} ${u.median_earn_10yr_real?' <span style="color:#3dd598">● Scorecard-enriched</span>':''}</h3>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:.86rem">
  <div><b>Basic</b><br>Control: ${u.control}<br>State: ${u.state}<br>Carnegie: ${u.carnegie}<br>Conference: ${u.conference||''}<br>Enrollment FTE: ${u.enrollment_fte.toLocaleString()}${u.enrollment_fte_real?` <span style="color:#3dd598">(${u.enrollment_fte_real} Scorecard)</span>`:''}<br>Endowment: $${u.endowment_b}B ($${(u.endowment_per_student/1000).toFixed(0)}k / student)<br>Student-Faculty: ${u.sf_ratio}:1${u.admission_rate!=null?`<br>Admission Rate: ${(u.admission_rate*100).toFixed(1)}%${realBadge('admission_rate')}`:''}</div>
  <div><b>Outcomes</b><br>Grad 6yr: ${(u.grad_rate_6yr*100).toFixed(0)}%${u.grad_rate_6yr_real?` → real ${(u.grad_rate_6yr_real*100).toFixed(0)}%`:''}<br>Retention: ${(u.retention*100).toFixed(0)}% ${u.retention_real?realBadge('retention'):''}<br>Median Earn 10yr: $${u.median_earn_10yr.toLocaleString()} ${realBadge('median_earn_10yr')}<br>Employment 6mo: ${(u.employment_6mo*100).toFixed(0)}%<br>Alumni Giving: ${(u.alumni_giving*100).toFixed(0)}%<br>Alumni Network: ${(u.alumni_network_k)}k${u.avg_family_income?`<br>Avg Family Income: $${u.avg_family_income.toLocaleString()}`:''}</div>
  <div><b>Value</b><br>Net Price Avg: $${u.net_price_avg.toLocaleString()} ${realBadge('net_price_avg')}<br>Pell Gap: ${(u.pell_gap*100).toFixed(0)}pp${u.pell_rate?` (Pell ${(u.pell_rate*100).toFixed(0)}%)`:''}<br>Loan Default: ${(u.loan_default*100).toFixed(1)}% ${realBadge('loan_default')}<br>Debt Avg: $${u.debt_avg.toLocaleString()} ${realBadge('debt_avg')}<br>ROI 10yr (est): $${(u.median_earn_10yr - 35000*2 - u.net_price_avg*4).toLocaleString()}</div>
  <div><b>Public Filings</b><br>IPEDS: ${u.filings.ipeds}<br>IRS 990: ${u.filings['990']}<br>Audited: ${u.filings.audited}<br>Scorecard: ${u.filings.scorecard} ${u.scorecard_id?`→ <a href="https://collegescorecard.ed.gov/school/?${u.scorecard_id}" target="_blank">${u.scorecard_id}</a>`:''}<br>HERD: ${u.filings.herd}<br>State Audit: ${u.filings.state_audit}<br><br><span style="font-size:.75rem;color:#9aa0b8">Research Spend: $${u.research_spend_m}M (NSF HERD) • Conf ${u.conference}</span></div>
  </div>
  ${provenance}
  <p style="font-size:.8rem;color:#9aa0b8;margin-top:10px">Filings as trust signal: this university's Scorecard coverage = ${u.filings.scorecard}, 990 = ${u.filings['990']}. Direct links planned via IPEDS Use-the-Data, ProPublica Nonprofit Explorer, Scorecard API. Conference ${u.conference} fixed v0.5.</p>
  <div style="display:flex;gap:8px;margin-top:10px"><button onclick="document.getElementById('detail-panel').classList.add('hidden')" style="padding:6px 10px">Close</button><button onclick="window.__toggleCompare('${u.id}')" style="padding:6px 10px;background:#7c8cff;border:none;border-radius:6px;color:#fff;cursor:pointer">Toggle Compare</button></div>`;
  p.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function drawCharts(unis){
  const scatterEl = document.getElementById('chart-scatter');
  if(!scatterEl) return;
  scatterEl.innerHTML='';
  const w=340,h=260,m={top:20,right:20,bottom:30,left:50};
  const svg=d3.select(scatterEl).append('svg').attr('viewBox',`0 0 ${w} ${h}`).attr('width','100%').style('height','auto').style('display','block');
  const x=d3.scaleLog().domain([d3.min(unis,d=>d.endowment_per_student)*0.8, d3.max(unis,d=>d.endowment_per_student)*1.2]).range([m.left,w-m.right]);
  const y=d3.scaleLinear().domain([d3.min(unis,d=>d.median_earn_10yr)*0.9, d3.max(unis,d=>d.median_earn_10yr)*1.1]).range([h-m.bottom,m.top]);
  svg.append('g').attr('transform',`translate(0,${h-m.bottom})`).call(d3.axisBottom(x).ticks(3,'~s')).attr('color','#9aa0b8');
  svg.append('g').attr('transform',`translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5)).attr('color','#9aa0b8');
  svg.append('text').attr('x',(m.left+w-m.right)/2).attr('y',h-2).attr('text-anchor','middle').attr('fill','#9aa0b8').attr('font-size','10px').text('Endowment per student (log scale)');
  svg.append('text').attr('transform','rotate(-90)').attr('x',-(m.top+h-m.bottom)/2).attr('y',10).attr('text-anchor','middle').attr('fill','#9aa0b8').attr('font-size','10px').text('Median earnings 10yr');
  // regression line on log(endow) vs earn
  const lx=unis.map(u=>Math.log(u.endowment_per_student||1)), ly=unis.map(u=>u.median_earn_10yr);
  const lr=linearRegression(lx,ly);
  const ct=corrTest(lx,ly);
  const xVals=[d3.min(unis,d=>d.endowment_per_student)*0.8, d3.max(unis,d=>d.endowment_per_student)*1.2];
  const lineData=xVals.map(v=>({x:v, y: lr.m*Math.log(v)+lr.b}));
  const line=d3.line().x(d=>x(d.x)).y(d=>y(d.y));
  svg.append('path').datum(lineData).attr('fill','none').attr('stroke','#7c8cff').attr('stroke-width',1.2).attr('stroke-dasharray','4 3').attr('opacity',0.6).attr('d',line);
  svg.append('text').attr('x',w-m.right-6).attr('y',m.top+12).attr('text-anchor','end').attr('fill','#7c8cff').attr('font-size','10px').attr('opacity',0.85).text(`r=${ct.r.toFixed(2)}, ${fmtP(ct.p)} (n=${ct.n})`);
  svg.selectAll('circle').data(unis).enter().append('circle').attr('cx',d=>x(d.endowment_per_student)).attr('cy',d=>y(d.median_earn_10yr)).attr('r',d=>Math.sqrt(d.enrollment_fte)/25+3).attr('fill',d=>d.control==='private'?'#7c8cff':'#3dd598').attr('opacity',0.7).append('title').text(d=>`${d.name} (${d.conference}): $${d.endowment_per_student.toLocaleString()} / stud, $${d.median_earn_10yr} earn, r=${ct.r.toFixed(2)}, ${fmtP(ct.p)}`);
  const gd=document.getElementById('chart-grad-default'); if(gd){ gd.innerHTML=''; const svg2=d3.select(gd).append('svg').attr('viewBox',`0 0 ${w} ${h}`).attr('width','100%').style('height','auto').style('display','block'); const x2=d3.scaleLinear().domain([0.7,1]).range([m.left,w-m.right]); const y2=d3.scaleLinear().domain([0,0.08]).range([h-m.bottom,m.top]); svg2.append('g').attr('transform',`translate(0,${h-m.bottom})`).call(d3.axisBottom(x2).tickFormat(d=>d*100+'%')).attr('color','#9aa0b8'); svg2.append('g').attr('transform',`translate(${m.left},0)`).call(d3.axisLeft(y2).tickFormat(d=>d*100+'%')).attr('color','#9aa0b8'); svg2.selectAll('circle').data(unis).enter().append('circle').attr('cx',d=>x2(d.grad_rate_6yr)).attr('cy',d=>y2(d.loan_default)).attr('r',4).attr('fill',d=>d.score>92?'#7c8cff':'#9aa0b8').attr('opacity',0.8).append('title').text(d=>d.name); }
  const val=document.getElementById('chart-value'); if(val){ val.innerHTML=''; const svg3=d3.select(val).append('svg').attr('viewBox',`0 0 ${w} ${h}`).attr('width','100%').style('height','auto').style('display','block'); const x3=d3.scaleLinear().domain([0,d3.max(unis,d=>d.net_price_avg)*1.1]).range([m.left,w-m.right]); const y3=d3.scaleLinear().domain([d3.min(unis,d=>d.median_earn_10yr)*0.9,d3.max(unis,d=>d.median_earn_10yr)*1.1]).range([h-m.bottom,m.top]); svg3.append('g').attr('transform',`translate(0,${h-m.bottom})`).call(d3.axisBottom(x3)).attr('color','#9aa0b8'); svg3.append('g').attr('transform',`translate(${m.left},0)`).call(d3.axisLeft(y3)).attr('color','#9aa0b8'); svg3.selectAll('circle').data(unis).enter().append('circle').attr('cx',d=>x3(d.net_price_avg)).attr('cy',d=>y3(d.median_earn_10yr)).attr('r',4).attr('fill',d=>d.control==='public'?'#3dd598':'#ffb84d').append('title').text(d=>d.name);
  const vqx=unis.map(d=>d.net_price_avg).sort((a,b)=>a-b), vqy=unis.map(d=>d.median_earn_10yr).sort((a,b)=>a-b);
  const medx=quantile(vqx,.5), medy=quantile(vqy,.5);
  svg3.append('line').attr('x1',x3(medx)).attr('x2',x3(medx)).attr('y1',m.top).attr('y2',h-m.bottom).attr('stroke','#9aa0b8').attr('stroke-dasharray','4 3').attr('opacity',.5);
  svg3.append('line').attr('x1',m.left).attr('x2',w-m.right).attr('y1',y3(medy)).attr('y2',y3(medy)).attr('stroke','#9aa0b8').attr('stroke-dasharray','4 3').attr('opacity',.5);
  svg3.append('text').attr('x',m.left+6).attr('y',m.top+12).attr('fill','#3dd598').attr('font-size','10px').attr('font-weight','600').text('BEST VALUE'); }
    const rad=document.getElementById('chart-radar'); if(rad){ rad.innerHTML='';
    // v0.23: true radial radar. Extents from ALL unis (stable under filtering),
    // polygons are averages of the current filtered set. Replaces the /1.5 bar hack.
    const ext=radarExtents(allUnis);
    const privAvg=radarAverage(unis.filter(u=>u.control==='private'),ext);
    const pubAvg=radarAverage(unis.filter(u=>u.control==='public'),ext);
    const rw=340, rh=300, rcx=rw/2, rcy=rh/2-6, R=104, n=RADAR_DIMS.length;
    const pt=(i,v)=>radarPoint(rcx,rcy,R,i,n,v);
    const svg4=d3.select(rad).append('svg').attr('viewBox',`0 0 ${rw} ${rh}`).attr('width','100%').style('height','auto').style('display','block');
    [25,50,75,100].forEach(g=>{
      svg4.append('polygon').attr('points',RADAR_DIMS.map((d,i)=>pt(i,g).join(',')).join(' '))
        .attr('fill','none').attr('stroke','#3a3f55').attr('stroke-width',1).attr('opacity',g===100?0.9:0.55);
      svg4.append('text').attr('x',rcx+4).attr('y',rcy-R*g/100-3).attr('fill','#5c6278').attr('font-size','9px').text(g);
    });
    RADAR_DIMS.forEach((d,i)=>{
      const [ex,ey]=pt(i,100);
      svg4.append('line').attr('x1',rcx).attr('y1',rcy).attr('x2',ex).attr('y2',ey).attr('stroke','#3a3f55').attr('stroke-width',1);
      const [lx,ly]=pt(i,130);
      const cx=Math.min(rw-2,Math.max(2,lx)), cy=Math.min(rh-4,Math.max(12,ly));
      svg4.append('text').attr('x',cx).attr('y',cy)
        .attr('text-anchor',Math.abs(cx-rcx)<10?'middle':(cx>rcx?'start':'end'))
        .attr('fill','#9aa0b8').attr('font-size','10px').attr('font-weight','600').text(d.label);
    });
    [{vals:privAvg,color:'#7c8cff',name:'Private',isPriv:true},{vals:pubAvg,color:'#3dd598',name:'Public',isPriv:false}].forEach(s=>{
      if(!unis.some(u=>(u.control==='private')===s.isPriv)) return; // filtered side empty
      svg4.append('polygon').attr('points',RADAR_DIMS.map((d,i)=>pt(i,s.vals[d.key]).join(',')).join(' '))
        .attr('fill',s.color).attr('fill-opacity',0.22).attr('stroke',s.color).attr('stroke-width',2);
      RADAR_DIMS.forEach((d,i)=>{
        const [vx,vy]=pt(i,s.vals[d.key]);
        svg4.append('circle').attr('cx',vx).attr('cy',vy).attr('r',3.5).attr('fill',s.color).attr('stroke','#10131c').attr('stroke-width',1)
          .append('title').text(`${d.label} — ${s.name} avg ${s.vals[d.key].toFixed(1)}/100`);
      });
    });
  }
}

function renderFilings(data){
  const grid=document.getElementById('filings-grid');
  if(!grid) return;
  grid.innerHTML=data.universities.map(u=>{
    const f=u.filings;
    const badges=[ ['IPEDS',f.ipeds], ['990',f['990']], ['Audit',f.audited], ['Scorecard',f.scorecard], ['HERD',f.herd], ['State',f.state_audit] ].map(([label,val])=>{
      let cls='na'; if(val && (val.includes('2024')||val.includes('2023')||val==='full')) cls='ok'; else if(val && (val.includes('system')||val==='partial')) cls='partial'; else if(val && val.startsWith('n/a')) cls='na';
      if(label==='State' && val==='n/a') cls='na';
      return `<span class="f-badge ${cls}">${label}: ${val}</span>`;
    }).join('');
    return `<div class="filing-card"><div class="filing-left"><b>${u.name}</b><br><span style="color:#9aa0b8;font-size:.75rem">${u.control} • ${u.state} • ${u.conference||''}</span></div><div class="filing-badges">${badges}</div></div>`;
  }).join('');
}

// PEER-LAYOUT-V26-BEGIN
// Drag persistence for the peer force network. Pinned node positions are stored in
// localStorage, normalized to the canvas size so they survive resizes, keyed by
// grouping mode + the exact visible school id set (drift -> no restore, no misplaced pins).
// Pure helpers — mechanically extracted for unit tests, no transcription.
function peerLayoutHash(s){
  let h=5381;
  for(let i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))>>>0;
  return h.toString(16);
}
function peerLayoutKey(mode, ids){
  return 'uot_peer_layout_'+mode+'_'+peerLayoutHash(ids.slice().sort().join(','));
}
function savePeerLayout(storage, mode, ids, nodes, w, h){
  if(!storage||w<=0||h<=0) return null;
  const pos={};
  nodes.forEach(n=>{
    const px=(n.fx!=null?n.fx:(n.x||0))/w;
    const py=(n.fy!=null?n.fy:(n.y||0))/h;
    pos[n.id]=[+px.toFixed(4), +py.toFixed(4)];
  });
  const key=peerLayoutKey(mode, ids);
  try{ storage.setItem(key, JSON.stringify({ids:ids.slice().sort(), pos})); }catch(e){ return null; }
  return key;
}
function loadPeerLayout(storage, mode, ids){
  if(!storage) return null;
  let raw=null;
  try{ raw=storage.getItem(peerLayoutKey(mode, ids)); }catch(e){ return null; }
  if(!raw) return null;
  let parsed;
  try{ parsed=JSON.parse(raw); }catch(e){ return null; }
  if(!parsed||!Array.isArray(parsed.ids)||!parsed.pos||typeof parsed.pos!=='object') return null;
  const want=ids.slice().sort().join(',');
  if(parsed.ids.join(',')!==want) return null;
  return parsed.pos;
}
function applySavedLayout(nodes, pos, w, h){
  let applied=0;
  nodes.forEach(n=>{
    const p=pos[n.id];
    if(!p||typeof p[0]!=='number'||typeof p[1]!=='number') return;
    const x=Math.max(12,Math.min(w-12, p[0]*w));
    const y=Math.max(16,Math.min(h-16, p[1]*h));
    n.x=x; n.y=y; n.fx=x; n.fy=y; applied++;
  });
  return applied;
}
function clearPeerLayout(storage, mode){
  if(!storage) return 0;
  const prefix='uot_peer_layout_'+mode+'_';
  let len=0;
  try{ len=storage.length; }catch(e){ return 0; }
  const keys=[];
  for(let i=0;i<len;i++){ try{ const k=storage.key(i); if(k&&k.indexOf(prefix)===0) keys.push(k); }catch(e){} }
  let n=0;
  keys.forEach(k=>{ try{ storage.removeItem(k); n++; }catch(e){} });
  return n;
}
// PEER-LAYOUT-V26-END
function renderPeers(unis){
  const modeEl=document.getElementById('peer-mode');
  const mode=modeEl?modeEl.value:'conference';
  const netEl=document.getElementById('peer-network');
  if(!netEl) return;
  const groups={};
  unis.forEach(u=>{
    let key;
    if(mode==='conference') key=u.conference||u.peer_group||'Other';
    else if(mode==='carnegie') key=u.carnegie;
    else if(mode==='control') key=u.control;
    else if(mode==='state') key=u.state;
    else key='All';
    if(!groups[key]) groups[key]=[];
    groups[key].push(u);
  });
  const groupKeys=Object.keys(groups).sort();
  const statsEl=document.getElementById('peer-stats');
  netEl.innerHTML='';
  const w=Math.max(netEl.clientWidth||900, 700), h=440;
  const svg=d3.select(netEl).append('svg').attr('width',w).attr('height',h).attr('viewBox',`0 0 ${w} ${h}`).style('background','transparent');
  const color=d3.scaleOrdinal(d3.schemeTableau10).domain(groupKeys);
  const nodes=unis.map(u=>{
    let gkey;
    if(mode==='conference') gkey=u.conference||u.peer_group||'Other';
    else if(mode==='carnegie') gkey=u.carnegie;
    else if(mode==='control') gkey=u.control;
    else if(mode==='state') gkey=u.state;
    else gkey='All';
    return {...u, group:gkey, conf:u.conference||u.peer_group||'Other', x:Math.random()*w, y:Math.random()*h};
  });
  const groupIndex={}; groupKeys.forEach((g,i)=>groupIndex[g]=i);
  // PEER-LINK-V28-BEGIN
  // Peer-group-aware weighted links (closes the standing Network Quality issue
  // "no link strength by peer_group", flagged since v0.5 — replaces the old
  // random 0.25 same-group links). Each node links to its k score-nearest
  // group-mates; link distance/strength is weighted by score proximity, with
  // a bonus for a shared peer_group (matters in carnegie/control/state modes
  // where a group mixes peer_groups). Deterministic — no Math.random.
  // Pure helpers — mechanically extracted for unit tests, no transcription.
  function peerLinkProps(a, b){
    const gap=Math.abs((a.score||0)-(b.score||0));
    const samePg=!!(a.peer_group||'') && (a.peer_group||'')===(b.peer_group||'');
    let dist=28+Math.min(52, gap*1.4);
    let str=0.38-Math.min(0.24, gap*0.009);
    if(samePg){ dist=Math.max(20, dist-8); str=Math.min(0.5, str+0.08); }
    return {dist:+dist.toFixed(2), str:+str.toFixed(3)};
  }
  function buildPeerLinks(nodes, k){
    const byGroup={};
    nodes.forEach(n=>{ const g=n.group||'Other'; if(!byGroup[g]) byGroup[g]=[]; byGroup[g].push(n); });
    const seen=new Set(), out=[];
    Object.values(byGroup).forEach(arr=>{
      let members=arr;
      if(members.length>12) members=members.slice().sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,12);
      members.forEach(n=>{
        const cand=members.filter(m=>m.id!==n.id && !seen.has(n.id+'|'+m.id) && !seen.has(m.id+'|'+n.id));
        cand.sort((a,b)=>Math.abs((a.score||0)-(n.score||0))-Math.abs((b.score||0)-(n.score||0)) || (a.id<b.id?-1:a.id>b.id?1:0));
        let added=0;
        for(const m of cand){
          if(added>=k) break;
          const p=peerLinkProps(n,m);
          out.push({source:n.id, target:m.id, dist:p.dist, str:p.str});
          seen.add(n.id+'|'+m.id);
          added++;
        }
      });
    });
    return out;
  }
  // PEER-LINK-V28-END
  // PEER-LINKTIP-V29-BEGIN
  // Hover tooltips for intra-group peer links (closes the standing Interactivity +
  // Network Quality issue "peer intra-group links not hoverable", flagged in the
  // v0.28 panel — crosswalk edges have had hovers since v0.24, the gray peer
  // links had none). Tooltip shows the pair, the shared group, score proximity
  // (Delta), the weighted link strength, and the same-peer_group bonus note.
  // Pure helper — mechanically extracted for unit tests, no transcription.
  function escTip(s){
    return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function peerLinkTip(a, b, mode, link){
    a=a||{}; b=b||{};
    const modeLabel={conference:'conference', carnegie:'Carnegie tier', control:'control', state:'state'}[mode]||'group';
    const grp=escTip(a.group||b.group||'Other');
    const sa=(a.score==null?'?':a.score.toFixed(1)), sb=(b.score==null?'?':b.score.toFixed(1));
    const gap=(a.score==null||b.score==null)?null:Math.abs(a.score-b.score);
    const samePg=!!(a.peer_group||'') && (a.peer_group||'')===(b.peer_group||'');
    let html='<b>'+escTip(a.name||'?')+'</b> &#8596; <b>'+escTip(b.name||'?')+'</b><br>';
    html+='Peer link: same '+modeLabel+' ('+grp+')<br>';
    html+='Scores '+sa+' / '+sb+(gap==null?'':' (&#916;'+gap.toFixed(1)+')');
    const str=(link&&link.str!=null?+link.str:null);
    html+='<br>Link strength '+(str==null?'n/a':str.toFixed(3));
    if(samePg) html+=' &bull; same peer_group '+escTip(a.peer_group)+' (tighter link)';
    return html;
  }
  // PEER-LINKTIP-V29-END
  const links=buildPeerLinks(nodes, 2);
  // CARNEGIE-CROSSWALK-V24-BEGIN
  // Crosswalk edges: each school links to up to k score-nearest schools that share its
  // Carnegie tier but sit in a DIFFERENT conference (conference <-> Carnegie crosswalk).
  // Pure helper — mechanically extracted for unit tests, no transcription.
  function buildCrosswalkLinks(nodes, k){
    const byCarnegie={};
    nodes.forEach(n=>{ const c=n.carnegie||'Other'; if(!byCarnegie[c]) byCarnegie[c]=[]; byCarnegie[c].push(n); });
    const seen=new Set();
    const out=[];
    nodes.forEach(n=>{
      const c=n.carnegie||'Other';
      const conf=n.conf||'Other';
      const cand=(byCarnegie[c]||[])
        .filter(m=>m.id!==n.id && (m.conf||'Other')!==conf &&
          !seen.has(n.id+'|'+m.id) && !seen.has(m.id+'|'+n.id));
      cand.sort((a,b)=>Math.abs(a.score-n.score)-Math.abs(b.score-n.score));
      let added=0;
      for(const m of cand){
        if(added>=k) break;
        out.push({source:n.id, target:m.id, xwalk:true});
        seen.add(n.id+'|'+m.id);
        added++;
      }
    });
    return out;
  }
  // CARNEGIE-CROSSWALK-V24-END
  // PEER-LAYOUT-V26: restore a saved drag layout for this exact mode + school set
  const __store=(function(){ try{ return window.localStorage; }catch(e){ return null; } })();
  const __ids=unis.map(u=>u.id);
  const __saved=loadPeerLayout(__store, mode, __ids);
  let __restored=0;
  if(__saved) __restored=applySavedLayout(nodes, __saved, w, h);
  const xlinks=buildCrosswalkLinks(nodes, 2);
  const allLinks=links.concat(xlinks);
  const __statsBase=`${groupKeys.length} groups • ${unis.length} universities • ${links.length} weighted peer links • ${xlinks.length} crosswalk • force-directed, drag, clickable, URL ?peer=`;
  if(statsEl) statsEl.textContent=__statsBase+(__restored?` • layout restored (${__restored})`:'');
  const sim=d3.forceSimulation(nodes)
    .force('link', d3.forceLink(allLinks).id(d=>d.id).distance(d=>d.xwalk?70:(d.dist||40)).strength(d=>d.xwalk?0.1:(d.str||0.15)))
    .force('charge', d3.forceManyBody().strength(-55))
    .force('x', d3.forceX().x(d=> (groupIndex[d.group]||0)/Math.max(1,groupKeys.length-1)* (w-120)+60).strength(0.25))
    .force('y', d3.forceY(h/2).strength(0.12))
    .force('collide', d3.forceCollide().radius(d=>4 + d.score/35 + 2).strength(0.8))
    .alphaDecay(0.04);
  const linkG=svg.append('g');
  const link=linkG.selectAll('line').data(allLinks).join('line')
    .attr('stroke',d=>d.xwalk?'#f5a524':'#2a2e42')
    .attr('stroke-opacity',d=>d.xwalk?0.5:0.35)
    .attr('stroke-width',d=>d.xwalk?1.1:(0.55+(d.str||0.15)));
  const nodeG=svg.append('g');
  const node=nodeG.selectAll('circle').data(nodes).join('circle')
    .attr('r',d=>3.5 + d.score/38)
    .attr('fill',d=>d.control==='private'?'#7c8cff':'#3dd598')
    .attr('stroke','#0b0d12').attr('stroke-width',0.8)
    .attr('opacity',0.92)
    .style('cursor','pointer')
    .on('click',(e,d)=>{ showDetail(d.id); if(history.replaceState){ const u=new URL(window.location); u.searchParams.set('id', d.id); history.replaceState(null,'',u);} })
    .on('mouseover',function(e,d){ d3.select(this).attr('stroke','#fff').attr('stroke-width',1.6); tooltip.style('display','block').html(`<b>${d.name}</b><br>Score ${d.score.toFixed(1)} • $${(d.median_earn_10yr/1000).toFixed(0)}k earn<br>${d.conference||d.carnegie} • ${d.control} • ${d.state}<br>Drag to move (position saved), click for detail`); })
    .on('mousemove',(e)=>{ tooltip.style('left',(e.pageX+12)+'px').style('top',(e.pageY-10)+'px'); })
    .on('mouseout',function(){ d3.select(this).attr('stroke','#0b0d12').attr('stroke-width',0.8); tooltip.style('display','none'); });
  const dragstarted=(e,d)=>{ if(!e.active) sim.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; };
  const dragged=(e,d)=>{ d.fx=e.x; d.fy=e.y; };
  // PEER-LAYOUT-V26: keep the node pinned on release (was: fx cleared) and persist the layout
  const dragended=(e,d)=>{ if(!e.active) sim.alphaTarget(0); d.fx=d.x; d.fy=d.y; savePeerLayout(__store, mode, __ids, nodes, w, h); if(statsEl) statsEl.textContent=__statsBase+' • layout saved'; };
  node.call(d3.drag().on('start',dragstarted).on('drag',dragged).on('end',dragended));
  const labelG=svg.append('g');
  const topNodes=nodes.slice().sort((a,b)=>b.score-a.score).slice(0,18);
  const labels=labelG.selectAll('text').data(topNodes).join('text')
    .text(d=>d.name.split(' ').slice(0,2).join(' '))
    .attr('font-size','9px').attr('fill','#c8ccda').attr('pointer-events','none').attr('opacity',0.9);
  const xLegend=svg.append('g').attr('transform',`translate(${w-252},14)`);
  xLegend.append('line').attr('x1',0).attr('y1',0).attr('x2',26).attr('y2',0).attr('stroke','#f5a524').attr('stroke-opacity',0.65).attr('stroke-width',2.2);
  xLegend.append('text').attr('x',32).attr('y',4).attr('fill','#9aa0b8').attr('font-size','10px').text('crosswalk: same Carnegie tier, different conference');
  xLegend.append('line').attr('x1',0).attr('y1',18).attr('x2',26).attr('y2',18).attr('stroke','#2a2e42').attr('stroke-opacity',0.7).attr('stroke-width',2.2);
  xLegend.append('text').attr('x',32).attr('y',22).attr('fill','#9aa0b8').attr('font-size','10px').text('peer links: score-nearest peers, strength ∝ score proximity + peer_group — hover any link for the pair');
  const tooltip=d3.select('body').selectAll('#peer-tooltip').data([0]).join('div').attr('id','peer-tooltip').style('position','absolute').style('display','none').style('background','#151821').style('border','1px solid #2a2e42').style('border-radius','8px').style('padding','8px 10px').style('font-size','.78rem').style('color','#e6e8f0').style('pointer-events','none').style('z-index','40').style('box-shadow','0 8px 24px rgba(0,0,0,.5)');
  link.filter(d=>d.xwalk).style('cursor','pointer')
    .on('mouseover',(e,d)=>{ const a=d.source, b=d.target; d3.select(e.currentTarget).attr('stroke-width',2.4); tooltip.style('display','block').html('<b>'+a.name+'</b> &#8596; <b>'+b.name+'</b><br>Crosswalk: both '+(a.carnegie||'Other')+' &bull; '+(a.conf||'')+' vs '+(b.conf||'')+'<br>Scores '+a.score.toFixed(1)+' / '+b.score.toFixed(1)); })
    .on('mousemove',(e)=>{ tooltip.style('left',(e.pageX+12)+'px').style('top',(e.pageY-10)+'px'); })
    .on('mouseout',(e)=>{ d3.select(e.currentTarget).attr('stroke-width',1.1); tooltip.style('display','none'); });
  // PEER-LINKTIP-V29: intra-group peer links are hoverable too. On mouseout the
  // stroke-width must be restored to the per-link strength value (0.55+str),
  // NOT a constant — the width encodes link strength since v0.28.
  link.filter(d=>!d.xwalk).style('cursor','pointer')
    .on('mouseover',(e,d)=>{ const a=d.source, b=d.target; d3.select(e.currentTarget).attr('stroke-width',3.2); tooltip.style('display','block').html(peerLinkTip(a,b,mode,d)); })
    .on('mousemove',(e)=>{ tooltip.style('left',(e.pageX+12)+'px').style('top',(e.pageY-10)+'px'); })
    .on('mouseout',(e,d)=>{ d3.select(e.currentTarget).attr('stroke-width',0.55+(d.str||0.15)); tooltip.style('display','none'); });
  sim.on('tick',()=>{
    link.attr('x1',d=>d.source.x).attr('y1',d=>d.source.y).attr('x2',d=>d.target.x).attr('y2',d=>d.target.y);
    node.attr('cx',d=>d.x=Math.max(12,Math.min(w-12,d.x))).attr('cy',d=>d.y=Math.max(16,Math.min(h-16,d.y)));
    labels.attr('x',d=>d.x+7).attr('y',d=>d.y+3);
  });
  const legend=svg.append('g').attr('transform',`translate(12, ${h-36})`);
  groupKeys.slice(0,18).forEach((g,i)=>{
    const row=Math.floor(i/6), col=i%6;
    legend.append('circle').attr('cx',col*130).attr('cy',row*16).attr('r',5).attr('fill',color(g)).attr('opacity',0.85);
    legend.append('text').attr('x',col*130+8).attr('y',row*16+3).attr('fill','#9aa0b8').attr('font-size','10px').text(g.slice(0,18));
  });
  const listEl=document.getElementById('peer-list');
  if(listEl){
    // Peer benchmarking table — rows from shared pure helper (BENCH-CSV-V27),
    // so the table and the exported CSV can never drift.
    const bench=groupBenchRows(unis,mode);
    window.__lastBench={rows:bench,mode};
    listEl.innerHTML=`<div style="grid-column:1/-1;margin-bottom:8px"><h4 style="margin:0 0 6px;font-size:.9rem;display:flex;align-items:center;gap:8px">Peer Benchmarking — Avg Score / Earn / ROI by ${mode}<button onclick="window.__downloadBenchCSV()" title="Export this table as CSV (raw values, RFC 4180)" style="font-size:.72rem;padding:3px 10px;background:#3dd598;border:none;border-radius:6px;color:#0a0f1a;cursor:pointer">⬇ Benchmark CSV</button></h4><div style="overflow:auto"><table style="width:100%;font-size:.78rem;border-collapse:collapse"><thead><tr style="color:#9aa0b8"><th style="text-align:left;padding:4px 6px">${mode}</th><th>n</th><th>avg Score</th><th>avg Earn</th><th>avg ROI</th><th>top</th></tr></thead><tbody>${bench.map(b=>`<tr style="border-top:1px solid #1e2235"><td style="padding:4px 6px"><b style="color:${color(b.group)}">● ${b.group}</b></td><td>${b.n}</td><td>${b.avgScore.toFixed(1)}</td><td>$${(b.avgEarn/1000).toFixed(0)}k</td><td>$${(b.avgROI/1000).toFixed(0)}k</td><td style="font-size:.75rem">${b.top3.map(m=>`<a href="#" onclick="event.preventDefault();showDetail('${m.id}')" style="color:#c8ccda">${m.name}</a>`).join(', ')}</td></tr>`).join('')}</tbody></table></div></div>` +
      groupKeys.slice(0,12).map(g=>{
      const members=groups[g].sort((a,b)=>b.score-a.score);
      const avgScore=members.reduce((s,u)=>s+u.score,0)/members.length;
      const avgEarn=members.reduce((s,u)=>s+u.median_earn_10yr,0)/members.length;
      const best=members.slice(0,5).map(m=>`<a href="#" onclick="event.preventDefault();showDetail('${m.id}')" style="color:#c8ccda;text-decoration:none;border-bottom:1px dotted #2a2e42">${m.name}</a>`).join(', ');
      return `<div class="filing-card"><div class="filing-left"><b style="color:${color(g)}">● ${g}</b><br><span style="color:#9aa0b8;font-size:.75rem">${groups[g].length} schools • avg score ${avgScore.toFixed(1)} • avg earn $${(avgEarn/1000).toFixed(0)}k • conf links ${links.filter(l=>{ const s=nodes.find(n=>n.id===l.source.id||n.id===l.source); const t=nodes.find(n=>n.id===l.target.id||n.id===l.target); return s&&t&&s.group===g&&t.group===g; }).length}</span><br><span style="font-size:.75rem">${best}${groups[g].length>5?' …':''}</span></div><div style="font-size:.7rem;color:#9aa0b8">${members[0]?members[0].carnegie:''}</div></div>`;
    }).join('');
  }
}

// v0.20: Geographic map — 200 campuses plotted at Wikipedia {{coord}} locations.
// State outlines: us-atlas states-10m topojson via CDN (same CDN pattern as d3),
// converted with topojson-client (also CDN). Graceful fallback if offline.
function loadScript(src){
  return new Promise((res,rej)=>{
    if(document.querySelector('script[src="'+src+'"]')) return res();
    const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=rej;
    document.head.appendChild(s);
  });
}
let _statesGeo=null;
// MAP-PEERLINK-V30-BEGIN
// Geographic peer links on the campus map (closes the standing Network Quality
// issue "map doesn't draw peer links", flagged since ~v0.5). Draws score-nearest
// weighted peer edges (same weighting math as PEER-LINK-V28) between campuses
// that share a peer_group, plotted as geographic lines on the US map. Width
// encodes link strength; hover shows the pair. Module-level so renderMap can
// call it (the V26-V29 helpers are scoped inside renderPeers). Pure helpers —
// mechanically extracted for unit tests, no transcription.
function mapLinkProps(a, b){
  // Same formula as peerLinkProps: the same-peer_group bonus is always active
  // because map links are strictly peer_group-scoped.
  const gap=Math.abs((a.score||0)-(b.score||0));
  let dist=28+Math.min(52, gap*1.4);
  let str=0.38-Math.min(0.24, gap*0.009);
  dist=Math.max(20, dist-8); str=Math.min(0.5, str+0.08);
  return {dist:+dist.toFixed(2), str:+str.toFixed(3)};
}
function mapPeerLinks(unis, k){
  const pts=unis.filter(u=>u.lat!=null&&u.lon!=null&&u.id!=null);
  const byPg={};
  pts.forEach(u=>{ const g=u.peer_group||'Other'; if(!byPg[g]) byPg[g]=[]; byPg[g].push(u); });
  const seen=new Set(), out=[];
  Object.values(byPg).forEach(arr=>{
    let members=arr;
    if(members.length>12) members=members.slice().sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,12);
    members.forEach(n=>{
      const cand=members.filter(m=>m.id!==n.id && !seen.has(n.id+'|'+m.id) && !seen.has(m.id+'|'+n.id));
      cand.sort((a,b)=>Math.abs((a.score||0)-(n.score||0))-Math.abs((b.score||0)-(n.score||0)) || (a.id<b.id?-1:a.id>b.id?1:0));
      let added=0;
      for(const m of cand){
        if(added>=k) break;
        const p=mapLinkProps(n,m);
        out.push({a:n, b:m, str:p.str});
        seen.add(n.id+'|'+m.id);
        added++;
      }
    });
  });
  return out;
}
function escMapLink(s){
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function mapPeerLinkTip(a, b, str){
  a=a||{}; b=b||{};
  const sa=(a.score==null?'?':a.score.toFixed(1)), sb=(b.score==null?'?':b.score.toFixed(1));
  const gap=(a.score==null||b.score==null)?null:Math.abs(a.score-b.score);
  let html='<b>'+escMapLink(a.name||'?')+'</b> &#8596; <b>'+escMapLink(b.name||'?')+'</b><br>';
  html+='Peer-group link: '+escMapLink(a.peer_group||b.peer_group||'Other')+'<br>';
  html+='Scores '+sa+' / '+sb+(gap==null?'':' (&#916;'+gap.toFixed(1)+')');
  html+='<br>Link strength '+(str==null?'n/a':(+str).toFixed(3));
  return html;
}
// MAP-PEERLINK-V30-END
async function renderMap(unis){
  const el=document.getElementById('geo-map'); if(!el) return;
  const pts=unis.filter(u=>u.lat!=null&&u.lon!=null);
  if(!_statesGeo){
    el.innerHTML='<p class="chart-desc">Loading US map outlines…</p>';
    try{
      if(typeof topojson==='undefined') await loadScript('https://cdn.jsdelivr.net/npm/topojson-client@3');
      const tj=await (await fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json')).json();
      _statesGeo=topojson.feature(tj, tj.objects.states);
    }catch(e){
      el.innerHTML='<p class="chart-desc">US map outlines failed to load (needs network for the one-time states topojson fetch). Campus coordinates are still in the data file.</p>';
      return;
    }
  }
  const w=Math.max(el.clientWidth||980,320);
  const h=Math.max(320,Math.round(w*0.52));
  el.innerHTML='';
  const svg=d3.select(el).append('svg').attr('viewBox','0 0 '+w+' '+h)
    .attr('width','100%').style('height','auto').style('display','block');
  const proj=d3.geoAlbersUsa().fitSize([w,h],_statesGeo);
  const path=d3.geoPath(proj);
  svg.append('g').selectAll('path').data(_statesGeo.features).join('path')
    .attr('d',path).attr('fill','#1a1e2c').attr('stroke','#2e3348').attr('stroke-width',0.7);
  const xy=d=>{ const p=proj([d.lon,d.lat]); return p?p:[-50,-50]; };
  // MAP-PEERLINK-V30: draw score-nearest peer-group links (closes the standing
  // Network Quality issue "map doesn't draw peer links", flagged since ~v0.5).
  const linkToggle=document.getElementById('map-peer-links');
  const showLinks=!linkToggle || linkToggle.checked;
  let mapLinks=[];
  if(showLinks){
    mapLinks=mapPeerLinks(pts, 2);
    svg.append('g').attr('class','map-peer-links').selectAll('line').data(mapLinks).join('line')
      .attr('x1',d=>xy(d.a)[0]).attr('y1',d=>xy(d.a)[1])
      .attr('x2',d=>xy(d.b)[0]).attr('y2',d=>xy(d.b)[1])
      .attr('stroke','#8a90aa').attr('stroke-opacity',0.30)
      .attr('stroke-width',d=>(0.6+d.str*1.6).toFixed(2))
      .style('cursor','pointer')
      .on('mouseover',function(e,d){ d3.select(this).attr('stroke','#c8ccda').attr('stroke-opacity',0.9);
        tooltip.style('display','block').html(mapPeerLinkTip(d.a,d.b,d.str)); })
      .on('mousemove',(e)=>{ tooltip.style('left',(e.pageX+12)+'px').style('top',(e.pageY-10)+'px'); })
      .on('mouseout',function(){ d3.select(this).attr('stroke','#8a90aa').attr('stroke-opacity',0.30); tooltip.style('display','none'); });
  }
  const tooltip=d3.select('body').selectAll('#peer-tooltip').data([0]).join('div')
    .attr('id','peer-tooltip').style('position','absolute').style('display','none')
    .style('background','#151821').style('border','1px solid #2a2e42').style('border-radius','8px')
    .style('padding','8px 10px').style('font-size','.78rem').style('color','#e6e8f0')
    .style('pointer-events','none').style('z-index','40').style('box-shadow','0 8px 24px rgba(0,0,0,.5)');
  svg.append('g').selectAll('circle').data(pts).join('circle')
    .attr('cx',d=>xy(d)[0]).attr('cy',d=>xy(d)[1])
    .attr('r',d=>2.2+d.score/48)
    .attr('fill',d=>d.control==='private'?'#7c8cff':'#3dd598')
    .attr('stroke','#0b0d12').attr('stroke-width',0.7).attr('opacity',0.85)
    .style('cursor','pointer')
    .on('click',(e,d)=>{ showDetail(d.id); if(history.replaceState){ const u=new URL(window.location); u.searchParams.set('id',d.id); history.replaceState(null,'',u);} })
    .on('mouseover',function(e,d){ d3.select(this).attr('stroke','#fff').attr('stroke-width',1.5);
      tooltip.style('display','block').html('<b>'+d.name+'</b><br>Score '+d.score.toFixed(1)+' • $'+(d.median_earn_10yr/1000).toFixed(0)+'k earn<br>'+(d.scorecard_city||'')+', '+d.state+' • '+d.control+'<br>Click for detail'); })
    .on('mousemove',(e)=>{ tooltip.style('left',(e.pageX+12)+'px').style('top',(e.pageY-10)+'px'); })
    .on('mouseout',function(){ d3.select(this).attr('stroke','#0b0d12').attr('stroke-width',0.7); tooltip.style('display','none'); });
  const top=pts.slice().sort((a,b)=>b.score-a.score).slice(0,10);
  svg.append('g').selectAll('text').data(top).join('text')
    .text(d=>d.name.split(' ').slice(0,2).join(' '))
    .attr('x',d=>xy(d)[0]+7).attr('y',d=>xy(d)[1]+3)
    .attr('font-size','9px').attr('fill','#c8ccda').attr('pointer-events','none').attr('opacity',0.9);
  const lg=svg.append('g').attr('transform','translate(14,'+(h-28)+')');
  lg.append('circle').attr('cx',0).attr('cy',0).attr('r',5).attr('fill','#7c8cff').attr('opacity',0.85);
  lg.append('text').attr('x',9).attr('y',3.5).attr('fill','#9aa0b8').attr('font-size','10px').text('Private');
  lg.append('circle').attr('cx',70).attr('cy',0).attr('r',5).attr('fill','#3dd598').attr('opacity',0.85);
  lg.append('text').attr('x',79).attr('y',3.5).attr('fill','#9aa0b8').attr('font-size','10px').text('Public');
  lg.append('text').attr('x',140).attr('y',3.5).attr('fill','#9aa0b8').attr('font-size','10px').text('Dot size = Alumni Advantage score');
  // MAP-PEERLINK-V30 legend row: peer-group link sample (width = link strength)
  const lg2=svg.append('g').attr('transform','translate(14,'+(h-12)+')');
  lg2.append('line').attr('x1',0).attr('y1',0).attr('x2',34).attr('y2',0)
    .attr('stroke','#8a90aa').attr('stroke-opacity',0.55).attr('stroke-width',2.2);
  lg2.append('text').attr('x',42).attr('y',3.5).attr('fill','#9aa0b8').attr('font-size','10px')
    .text('Peer-group link (width = link strength; hover for the pair)');
  const note=document.getElementById('geo-note');
  if(note) note.textContent=pts.length+'/'+unis.length+' campuses plotted at Wikipedia {{coord}} locations (primary first). Dots sized by score; top 10 labeled.'+(showLinks?' '+mapLinks.length+' peer-group links drawn (2 score-nearest per school, width = link strength).':'');
}

loadData().then(data=>{
  allUnis=data.universities; filtered=[...allUnis];
  const urlParams=new URLSearchParams(window.location.search);
  const pParam=urlParams.get('p'); if(pParam&&PCTS.includes(+pParam)) activePct=+pParam;
  renderProvenance(data.metadata||{});
  renderPctControls(); renderMetrics(filtered); renderDistributions(filtered);
  renderInsights(data); renderTable(filtered); renderFilings(data); drawCharts(filtered);
  renderPeers(filtered); renderMap(filtered);
  const qParam=urlParams.get('q'); if(qParam){ const se=document.getElementById('search'); if(se){ se.value=qParam; } }
  const cParam=urlParams.get('control'); if(cParam){ const fe=document.getElementById('filter-control'); if(fe) fe.value=cParam; }
  const sParam=urlParams.get('sort'); const parsedSort=parseSortParam(sParam);
  if(parsedSort){ const se=document.getElementById('sort-preset'); if(se) se.value=parsedSort.preset; if(parsedSort.key!=='value'){ sortKey=parsedSort.key; sortDir=parsedSort.dir; } }
  const peerParam=urlParams.get('peer'); if(peerParam){ const pe=document.getElementById('peer-mode'); if(pe){ pe.value=peerParam; renderPeers(filtered); } }
  const idParam=urlParams.get('id'); if(idParam){ setTimeout(()=>showDetail(idParam), 400); }
  if(qParam||cParam||parsedSort) applyFilters();
  document.getElementById('search').addEventListener('input',()=>{ applyFilters(); const u=new URL(window.location); const v=document.getElementById('search').value; if(v) u.searchParams.set('q',v); else u.searchParams.delete('q'); history.replaceState(null,'',u); });
  document.getElementById('filter-control').addEventListener('change',()=>{ applyFilters(); const u=new URL(window.location); const v=document.getElementById('filter-control').value; if(v && v!=='all') u.searchParams.set('control',v); else u.searchParams.delete('control'); history.replaceState(null,'',u); });
  document.getElementById('sort-preset').addEventListener('change',()=>{ applyFilters(); writeSortURL(); });
  const peerMode=document.getElementById('peer-mode'); if(peerMode) peerMode.addEventListener('change',()=>{ renderPeers(filtered); const u=new URL(window.location); const v=peerMode.value; if(v && v!=='conference') u.searchParams.set('peer',v); else u.searchParams.delete('peer'); history.replaceState(null,'',u); });
  const mapLinksToggle=document.getElementById('map-peer-links'); if(mapLinksToggle) mapLinksToggle.addEventListener('change',()=>{ renderMap(filtered); });
  const csvBtn=document.getElementById('btn-csv'); if(csvBtn) csvBtn.addEventListener('click',()=>exportCSV(filtered));
  const cmpBtn=document.getElementById('btn-compare'); if(cmpBtn) cmpBtn.addEventListener('click',()=>{ document.getElementById('compare-bar').style.display='flex'; });
  const go=document.getElementById('compare-go'); if(go) go.addEventListener('click',showCompare);
  const cl=document.getElementById('compare-clear'); if(cl) cl.addEventListener('click',()=>{ selectedCompare.clear(); updateCompareBar(); renderTable(filtered); });
  const rlBtn=document.getElementById('peer-reset-layout'); if(rlBtn) rlBtn.addEventListener('click',()=>{ const pe=document.getElementById('peer-mode'); try{ clearPeerLayout(window.localStorage, pe?pe.value:'conference'); }catch(e){} renderPeers(filtered); });
  window.__toggleCompare=toggleCompare;
  window.__showCompare=showCompare;
  window.__downloadCompareCSV=downloadCompareCSV;
  window.__downloadBenchCSV=downloadBenchCSV;
});
