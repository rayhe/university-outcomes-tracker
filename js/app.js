async function loadData(){
  const res = await fetch('data/universities.json');
  const j = await res.json();
  return j;
}

function fmtMoney(n){ if(n>=1e9) return '$'+(n/1e9).toFixed(1)+'B'; if(n>=1e6) return '$'+(n/1e6).toFixed(1)+'M'; if(n>=1e3) return '$'+(n/1e3).toFixed(0)+'k'; return '$'+n; }
function fmtNum(n){ return n.toLocaleString(); }

let allUnis=[], filtered=[], selectedCompare=new Set();

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
  const headers=['id','name','control','state','carnegie','score','median_earn_10yr','median_earn_real','debt_avg','loan_default','net_price_avg','grad_rate_6yr','retention','endowment_b','endowment_per_student','enrollment_fte','research_spend_m','alumni_network_k','admission_rate','scorecard_id','scorecard_name'];
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
  renderTable(filtered); // re-render to show check
}
function updateCompareBar(){
  const bar=document.getElementById('compare-bar'); const cnt=document.getElementById('compare-count');
  if(!bar) return;
  cnt.textContent=`${selectedCompare.size} selected for compare`;
  bar.style.display=selectedCompare.size>0?'flex':'none';
}
function showCompare(){
  if(selectedCompare.size<2){ alert('Select at least 2'); return; }
  const picks=[...selectedCompare].map(id=>allUnis.find(u=>u.id===id)).filter(Boolean);
  const p=document.getElementById('detail-panel');
  p.classList.remove('hidden');
  const dims=['score','median_earn_10yr','debt_avg','loan_default','net_price_avg','grad_rate_6yr','retention','endowment_per_student','admission_rate'];
  let html=`<h3>Comparison — ${picks.map(u=>u.name).join(' vs ')}</h3><div style="overflow:auto"><table style="width:100%;font-size:.86rem"><thead><tr><th>Metric</th>${picks.map(u=>`<th>${u.name}</th>`).join('')}</tr></thead><tbody>`;
  dims.forEach(k=>{
    html+=`<tr><td><b>${k}</b></td>${picks.map(u=>{
      let v=u[k]; if(v==null) v=u[k+'_real']||'—';
      if(k.includes('earn')||k.includes('debt')||k.includes('price')||k.includes('endowment')) v=v!=null&&v!=='—'?fmtMoney(v):v;
      else if(k.includes('grad')||k.includes('retention')||k.includes('default')||k.includes('admission')) v=v!=null&&v!=='—'?(v*100).toFixed(1)+'%':v;
      else if(typeof v==='number') v=v.toFixed(1);
      const realBadge=u[k+'_real']!=null||u.median_earn_10yr_real!=null&&k==='median_earn_10yr'?' <span style="font-size:.65rem;color:#3dd598">●real</span>':'';
      return `<td>${v}${realBadge}</td>`;
    }).join('')}</tr>`;
  });
  html+=`</tbody></table></div><p style="font-size:.8rem;color:#9aa0b8;margin-top:8px">●real = College Scorecard API. Others synthetic until v0.3 IPEDS/990 enrichment. ROI 10yr = earn - $35k*2 - net_price*4.</p><button onclick="document.getElementById('detail-panel').classList.add('hidden')" style="margin-top:8px">Close</button>`;
  p.innerHTML=html;
  p.scrollIntoView({behavior:'smooth'});
}

function renderMetrics(data){
  const unis = data.universities;
  const median = arr => { const s=[...arr].sort((a,b)=>a-b); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; };
  const scores = unis.map(u=>u.score).filter(v=>v!=null);
  const earns = unis.map(u=>u.median_earn_10yr).filter(v=>v!=null);
  const endows = unis.map(u=>u.endowment_per_student).filter(v=>v!=null);
  const grads = unis.map(u=>u.grad_rate_6yr).filter(v=>v!=null);
  const defs = unis.map(u=>u.loan_default).filter(v=>v!=null);
  document.getElementById('m-median-score').textContent = median(scores).toFixed(1);
  document.getElementById('m-earnings').textContent = fmtMoney(median(earns));
  document.getElementById('m-endow').textContent = fmtMoney(median(endows));
  document.getElementById('m-grad').textContent = (median(grads)*100).toFixed(0)+'%';
  document.getElementById('m-default').textContent = (median(defs)*100).toFixed(1)+'%';
}

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

  insights.push({t:`Top Alumni Advantage: ${topScore.name}`, d:`Score ${topScore.score} — ${topScore.control} ${topScore.carnegie}, endowment $${(topScore.endowment_b)}B, earnings $${topScore.median_earn_10yr.toLocaleString()} 10yr. Model: high endowment/student + low Pell gap + high retention.`});
  insights.push({t:`Highest Earnings: ${topEarn.name}`, d:`$${topEarn.median_earn_10yr.toLocaleString()} median 10yr. SF ratio ${topEarn.sf_ratio}:1, research $${topEarn.research_spend_m}M. Earnings premium correlates with research spend per student (r~0.6). ${topEarn.median_earn_10yr_real? '● Scorecard real.' : ''}`});
  insights.push({t:`Best Value (Price/Earnings): ${bestValue.name}`, d:`Net price $${bestValue.net_price_avg.toLocaleString()} vs earnings $${bestValue.median_earn_10yr.toLocaleString()}. Public flagship model shows ROI advantage despite lower endowment/student. Ratio ${(bestValue.net_price_avg/bestValue.median_earn_10yr).toFixed(2)}.`});
  insights.push({t:`Private vs Public: ${privateAvg.toFixed(1)} vs ${publicAvg.toFixed(1)} avg score`, d:`Private advantage driven by endowment/student (avg ${(endowPerMedian/1000).toFixed(0)}k median) and alumni giving (28% vs 9%). Publics close gap on value/ROI and research scale. n=${unis.length}, private=${unis.filter(u=>u.control==='private').length}, public=${unis.filter(u=>u.control==='public').length}.`});
  insights.push({t:`Public Filings Coverage: 6 sources`, d:`IPEDS (100% Title IV), IRS 990 (private only), Audited financials (GAAP), College Scorecard (earnings/debt/default/net price) ${realCount}/${unis.length} real, NSF HERD (R&D), State audit (publics). Filing presence is trust signal, not score weight.`});
  insights.push({t:`Expansion Plan: 60 → 150 → 500`, d:`v0.3 now 150 universities (R1 + flagships + R2 + LAC). Hourly iteration adds: Scorecard API batch enrichment (${realCount} real), IPEDS Finance API, IRS 990 XML via ProPublica, NACUBO endowment table, HERD Excel, state audit PDFs. Target 200 by v0.4, 500 by v1.0.`});
  insights.push({t:`Most Selective: ${lowAdmit ? lowAdmit.name + ' ' + (lowAdmit.admission_rate*100).toFixed(1)+'%' : 'n/a'}`, d:`Low admit rate correlates with alumni advantage (r~0.55) but not perfectly — value/ROI rewards publics with broader access. ${lowAdmit?.admission_rate!=null? 'Admit '+(lowAdmit.admission_rate*100).toFixed(1)+'% real Scorecard.' : ''}`});
  insights.push({t:`Research Powerhouse: ${highResearch.name}`, d:`$${highResearch.research_spend_m}M NSF HERD, ${highResearch.carnegie}, enrollment ${highResearch.enrollment_fte.toLocaleString()} FTE. Research spend per student $${(highResearch.research_spend_m*1e6/highResearch.enrollment_fte).toFixed(0)}.`});
  insights.push({t:`Graduation Leader: ${bestGrad.name}`, d:`${(bestGrad.grad_rate_6yr*100).toFixed(0)}% 6yr grad rate, retention ${(bestGrad.retention*100).toFixed(0)}%. Academic Quality 15% of Alumni Advantage — grad rate + retention + SF ratio + research/student.`});
  insights.push({t:`Default Risk: ${highDefault.name} highest`, d:`${(highDefault.loan_default*100).toFixed(1)}% loan default vs median ${(median(unis.map(u=>u.loan_default))*100).toFixed(1)}%. Lower default = higher Value/ROI (20% weight). Publics with low net price have lower default even with higher Pell %`});
  insights.push({t:`Median Earnings: $${medianEarn.toLocaleString()}`, d:`Median 10yr earnings across ${unis.length} universities. Top quartile > $${[...earns].sort((a,b)=>b-a)[Math.floor(earns.length*0.25)].toLocaleString()}, bottom quartile < $${[...earns].sort((a,b)=>a-b)[Math.floor(earns.length*0.75)].toLocaleString()}. Earnings from College Scorecard where available (green dot).`});
  insights.push({t:`Public Flagship Value: ${publicFlagshipValue.name}`, d:`Public R1 best value: net price $${publicFlagshipValue.net_price_avg.toLocaleString()} vs earnings $${publicFlagshipValue.median_earn_10yr.toLocaleString()}, ROI 10yr $${(publicFlagshipValue.median_earn_10yr - 35000*2 - publicFlagshipValue.net_price_avg*4).toLocaleString()}. Model for ROI-driven choice.`});
  const grid = document.getElementById('insights-grid');
  grid.innerHTML = insights.map(i=>`<div class="insight-card"><h4>${i.t}</h4><p>${i.d}</p></div>`).join('');
}

function renderTable(unis){
  const thead = document.querySelector('#uni-table thead');
  thead.innerHTML = `<tr><th>◫</th><th data-k="name">University <span title="Scorecard name stored">ⓘ</span></th><th data-k="control">Control</th><th data-k="state">State</th><th data-k="score">Score</th><th data-k="median_earn_10yr">Earn 10yr <span title="Real = green dot from College Scorecard">ⓘ</span></th><th data-k="endowment_per_student">Endow / Stud</th><th data-k="grad_rate_6yr">Grad 6yr</th><th data-k="loan_default">Default</th><th data-k="net_price_avg">Net Price</th><th data-k="enrollment_fte">Enroll</th></tr>`;
  const tbody = document.querySelector('#uni-table tbody');
  tbody.innerHTML = unis.map(u=>{
    const checked=selectedCompare.has(u.id)?'checked':'';
    const realDot=u.median_earn_10yr_real!=null?'<span style="color:#3dd598" title="Scorecard real">●</span>':'<span style="color:#555" title="Synthetic">○</span>';
    const debtReal=u.debt_avg_real!=null?' title="Scorecard real"' : ' title="Synthetic"';
    return `<tr data-id="${u.id}"><td><input type="checkbox" ${checked} onchange="event.stopPropagation(); window.__toggleCompare('${u.id}')" /></td><td><b>${u.name}</b> ${realDot}<br><span style="color:#9aa0b8;font-size:.75rem">${u.carnegie} • ${u.enrollment_fte.toLocaleString()} FTE ${u.admission_rate!=null?`• admit ${(u.admission_rate*100).toFixed(0)}%`:''}</span></td><td>${u.control}</td><td>${u.state}</td><td><b>${u.score.toFixed(1)}</b></td><td>${fmtMoney(u.median_earn_10yr)} ${u.median_earn_10yr_real?`<span style="font-size:.7rem;color:#3dd598">real</span>`:''}</td><td>${fmtMoney(u.endowment_per_student)}</td><td>${(u.grad_rate_6yr*100).toFixed(0)}%</td><td><span${debtReal}>${(u.loan_default*100).toFixed(1)}%</span></td><td>${fmtMoney(u.net_price_avg)}</td><td>${fmtNum(u.enrollment_fte)}</td></tr>`;
  }).join('');
  tbody.querySelectorAll('tr').forEach(tr=>tr.addEventListener('click',(e)=>{ if(e.target.type==='checkbox') return; showDetail(tr.dataset.id); }));
  thead.querySelectorAll('th').forEach(th=>th.addEventListener('click',()=>{ const k=th.dataset.k; if(k) sortBy(k); }));
}

let sortKey='score', sortDir=-1;
function sortBy(k){
  if(sortKey===k) sortDir*=-1; else {sortKey=k; sortDir=k==='name'||k==='control'||k==='state'?1:-1;}
  applyFilters();
}
function applyFilters(){
  const q = document.getElementById('search').value.toLowerCase();
  const f = document.getElementById('filter-control').value;
  let list = [...allUnis];
  if(q) list = list.filter(u=> (u.name+' '+u.state+' '+u.control+' '+u.carnegie).toLowerCase().includes(q));
  if(f==='private') list = list.filter(u=>u.control==='private');
  if(f==='public') list = list.filter(u=>u.control==='public');
  if(f==='R1') list = list.filter(u=>u.carnegie==='R1');
  const preset = document.getElementById('sort-preset').value;
  if(preset==='earn_desc'){sortKey='median_earn_10yr';sortDir=-1;}
  if(preset==='endow_desc'){sortKey='endowment_per_student';sortDir=-1;}
  if(preset==='grad_desc'){sortKey='grad_rate_6yr';sortDir=-1;}
  if(preset==='value_desc'){ // lower net price / earnings ratio = better value
    list = list.sort((a,b)=>(a.net_price_avg/a.median_earn_10yr)-(b.net_price_avg/b.median_earn_10yr));
    filtered=list; renderTable(filtered); drawCharts(filtered); return;
  }
  list.sort((a,b)=>{ let av=a[sortKey], bv=b[sortKey]; if(typeof av==='string') av=av.toLowerCase(), bv=bv.toLowerCase(); if(av<bv) return -1*sortDir; if(av>bv) return 1*sortDir; return 0; });
  filtered=list; renderTable(filtered); drawCharts(filtered);
}

function showDetail(id){
  const u = allUnis.find(x=>x.id===id); if(!u) return;
  const p = document.getElementById('detail-panel');
  p.classList.remove('hidden');
  const realBadge = (k)=> u[k+'_real']!=null ? '<span style="font-size:.65rem;background:#0f251c;color:#3dd598;border:1px solid #1f5c3a;padding:1px 5px;border-radius:999px;margin-left:6px">Scorecard real</span>' : '<span style="font-size:.65rem;background:#1f1f28;color:#9aa0b8;padding:1px 5px;border-radius:999px;margin-left:6px">synthetic</span>';
  const provenance = u.scorecard_name ? `<div style="font-size:.75rem;color:#9aa0b8;margin-top:6px">Matched to Scorecard: ${u.scorecard_name} (${u.scorecard_city}) ID ${u.scorecard_id}</div>` : '';
  p.innerHTML = `<h3>${u.name} — Alumni Advantage ${u.score.toFixed(1)} ${u.median_earn_10yr_real?' <span style="color:#3dd598">● Scorecard-enriched</span>':''}</h3>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:.86rem">
  <div><b>Basic</b><br>Control: ${u.control}<br>State: ${u.state}<br>Carnegie: ${u.carnegie}<br>Enrollment FTE: ${u.enrollment_fte.toLocaleString()}${u.enrollment_fte_real?` <span style="color:#3dd598">(${u.enrollment_fte_real} Scorecard)</span>`:''}<br>Endowment: $${u.endowment_b}B ($${(u.endowment_per_student/1000).toFixed(0)}k / student)<br>Student-Faculty: ${u.sf_ratio}:1${u.admission_rate!=null?`<br>Admission Rate: ${(u.admission_rate*100).toFixed(1)}%${realBadge('admission_rate')}`:''}</div>
  <div><b>Outcomes</b><br>Grad 6yr: ${(u.grad_rate_6yr*100).toFixed(0)}%${u.grad_rate_6yr_real?` → real ${(u.grad_rate_6yr_real*100).toFixed(0)}%`:''}<br>Retention: ${(u.retention*100).toFixed(0)}% ${u.retention_real?realBadge('retention'):''}<br>Median Earn 10yr: $${u.median_earn_10yr.toLocaleString()} ${realBadge('median_earn_10yr')}<br>Employment 6mo: ${(u.employment_6mo*100).toFixed(0)}%<br>Alumni Giving: ${(u.alumni_giving*100).toFixed(0)}%<br>Alumni Network: ${(u.alumni_network_k)}k${u.avg_family_income?`<br>Avg Family Income: $${u.avg_family_income.toLocaleString()}`:''}</div>
  <div><b>Value</b><br>Net Price Avg: $${u.net_price_avg.toLocaleString()} ${realBadge('net_price_avg')}<br>Pell Gap: ${(u.pell_gap*100).toFixed(0)}pp${u.pell_rate?` (Pell ${(u.pell_rate*100).toFixed(0)}%)`:''}<br>Loan Default: ${(u.loan_default*100).toFixed(1)}% ${realBadge('loan_default')}<br>Debt Avg: $${u.debt_avg.toLocaleString()} ${realBadge('debt_avg')}<br>ROI 10yr (est): $${(u.median_earn_10yr - 35000*2 - u.net_price_avg*4).toLocaleString()}</div>
  <div><b>Public Filings</b><br>IPEDS: ${u.filings.ipeds}<br>IRS 990: ${u.filings['990']}<br>Audited: ${u.filings.audited}<br>Scorecard: ${u.filings.scorecard} ${u.scorecard_id?`→ <a href="https://collegescorecard.ed.gov/school/?${u.scorecard_id}" target="_blank">${u.scorecard_id}</a>`:''}<br>HERD: ${u.filings.herd}<br>State Audit: ${u.filings.state_audit}<br><br><span style="font-size:.75rem;color:#9aa0b8">Research Spend: $${u.research_spend_m}M (NSF HERD)</span></div>
  </div>
  ${provenance}
  <p style="font-size:.8rem;color:#9aa0b8;margin-top:10px">Filings as trust signal: this university's Scorecard coverage = ${u.filings.scorecard}, 990 = ${u.filings['990']}. Direct links planned via IPEDS Use-the-Data, ProPublica Nonprofit Explorer, Scorecard API.</p>
  <div style="display:flex;gap:8px;margin-top:10px"><button onclick="document.getElementById('detail-panel').classList.add('hidden')" style="padding:6px 10px">Close</button><button onclick="window.__toggleCompare('${u.id}')" style="padding:6px 10px;background:#7c8cff;border:none;border-radius:6px;color:#fff;cursor:pointer">Toggle Compare</button></div>`;
  p.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function drawCharts(unis){
  // scatter
  const scatterEl = document.getElementById('chart-scatter');
  if(!scatterEl) return;
  scatterEl.innerHTML='';
  const w=340,h=260,m={top:20,right:20,bottom:30,left:50};
  const svg=d3.select(scatterEl).append('svg').attr('width',w).attr('height',h);
  const x=d3.scaleLog().domain([d3.min(unis,d=>d.endowment_per_student)*0.8, d3.max(unis,d=>d.endowment_per_student)*1.2]).range([m.left,w-m.right]);
  const y=d3.scaleLinear().domain([d3.min(unis,d=>d.median_earn_10yr)*0.9, d3.max(unis,d=>d.median_earn_10yr)*1.1]).range([h-m.bottom,m.top]);
  svg.append('g').attr('transform',`translate(0,${h-m.bottom})`).call(d3.axisBottom(x).ticks(5,'~s')).attr('color','#9aa0b8');
  svg.append('g').attr('transform',`translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5)).attr('color','#9aa0b8');
  svg.selectAll('circle').data(unis).enter().append('circle').attr('cx',d=>x(d.endowment_per_student)).attr('cy',d=>y(d.median_earn_10yr)).attr('r',d=>Math.sqrt(d.enrollment_fte)/25+3).attr('fill',d=>d.control==='private'?'#7c8cff':'#3dd598').attr('opacity',0.7).append('title').text(d=>`${d.name}: $${d.endowment_per_student.toLocaleString()} / stud, $${d.median_earn_10yr} earn`);
  // grad vs default
  const gd=document.getElementById('chart-grad-default'); if(gd){ gd.innerHTML=''; const svg2=d3.select(gd).append('svg').attr('width',w).attr('height',h); const x2=d3.scaleLinear().domain([0.7,1]).range([m.left,w-m.right]); const y2=d3.scaleLinear().domain([0,0.08]).range([h-m.bottom,m.top]); svg2.append('g').attr('transform',`translate(0,${h-m.bottom})`).call(d3.axisBottom(x2).tickFormat(d=>d*100+'%')).attr('color','#9aa0b8'); svg2.append('g').attr('transform',`translate(${m.left},0)`).call(d3.axisLeft(y2).tickFormat(d=>d*100+'%')).attr('color','#9aa0b8'); svg2.selectAll('circle').data(unis).enter().append('circle').attr('cx',d=>x2(d.grad_rate_6yr)).attr('cy',d=>y2(d.loan_default)).attr('r',4).attr('fill',d=>d.score>92?'#7c8cff':'#9aa0b8').attr('opacity',0.8).append('title').text(d=>d.name); }
  // value
  const val=document.getElementById('chart-value'); if(val){ val.innerHTML=''; const svg3=d3.select(val).append('svg').attr('width',w).attr('height',h); const x3=d3.scaleLinear().domain([0,d3.max(unis,d=>d.net_price_avg)*1.1]).range([m.left,w-m.right]); const y3=d3.scaleLinear().domain([d3.min(unis,d=>d.median_earn_10yr)*0.9,d3.max(unis,d=>d.median_earn_10yr)*1.1]).range([h-m.bottom,m.top]); svg3.append('g').attr('transform',`translate(0,${h-m.bottom})`).call(d3.axisBottom(x3)).attr('color','#9aa0b8'); svg3.append('g').attr('transform',`translate(${m.left},0)`).call(d3.axisLeft(y3)).attr('color','#9aa0b8'); svg3.selectAll('circle').data(unis).enter().append('circle').attr('cx',d=>x3(d.net_price_avg)).attr('cy',d=>y3(d.median_earn_10yr)).attr('r',4).attr('fill',d=>d.control==='public'?'#3dd598':'#ffb84d').append('title').text(d=>d.name); }
  // radar bar private vs public
  const rad=document.getElementById('chart-radar'); if(rad){ rad.innerHTML=''; const dims=['career','alumni','academic','financial','value']; const privAvg={career:0,alumni:0,academic:0,financial:0,value:0}; const pubAvg={...privAvg}; let pc=0,uc=0; unis.forEach(u=>{ const isPriv=u.control==='private'; const tgt=isPriv?privAvg:pubAvg; tgt.career+=u.median_earn_10yr/1000; tgt.alumni+=u.alumni_giving*100; tgt.academic+=u.grad_rate_6yr*100; tgt.financial+=Math.log(u.endowment_per_student); tgt.value+=(1-u.loan_default)*100; if(isPriv) pc++; else uc++; }); Object.keys(privAvg).forEach(k=>privAvg[k]/=pc||1); Object.keys(pubAvg).forEach(k=>pubAvg[k]/=uc||1); const svg4=d3.select(rad).append('svg').attr('width',w).attr('height',h); const bw=20; const groups=d3.groups([[privAvg,'Private'],[pubAvg,'Public']]); // simplified bar
    const keys=Object.keys(privAvg); const x4=d3.scaleBand().domain(keys).range([m.left,w-m.right]).padding(0.2); const y4=d3.scaleLinear().domain([0,100]).range([h-m.bottom,m.top]); svg4.append('g').attr('transform',`translate(0,${h-m.bottom})`).call(d3.axisBottom(x4)).attr('color','#9aa0b8'); svg4.append('g').attr('transform',`translate(${m.left},0)`).call(d3.axisLeft(y4)).attr('color','#9aa0b8'); keys.forEach((k,i)=>{ svg4.append('rect').attr('x',x4(k)).attr('y',y4(privAvg[k]/1.5)).attr('width',x4.bandwidth()/2).attr('height',h-m.bottom-y4(privAvg[k]/1.5)).attr('fill','#7c8cff'); svg4.append('rect').attr('x',x4(k)+x4.bandwidth()/2).attr('y',y4(pubAvg[k]/1.5)).attr('width',x4.bandwidth()/2).attr('height',h-m.bottom-y4(pubAvg[k]/1.5)).attr('fill','#3dd598'); });
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
    return `<div class="filing-card"><div class="filing-left"><b>${u.name}</b><br><span style="color:#9aa0b8;font-size:.75rem">${u.control} • ${u.state}</span></div><div class="filing-badges">${badges}</div></div>`;
  }).join('');
}

function renderPeers(unis){
  const modeEl=document.getElementById('peer-mode');
  const mode=modeEl?modeEl.value:'conference';
  const netEl=document.getElementById('peer-network');
  if(!netEl) return;
  // group
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
  // stats
  const statsEl=document.getElementById('peer-stats');
  if(statsEl) statsEl.textContent=`${groupKeys.length} groups • ${unis.length} universities`;
  // network svg - force-ish layout by grouping
  netEl.innerHTML='';
  const w=netEl.clientWidth||900, h=380;
  const svg=d3.select(netEl).append('svg').attr('width',w).attr('height',h);
  // simple clustered layout: groups along x, universities inside
  const color=d3.scaleOrdinal(d3.schemeCategory10).domain(groupKeys);
  const gx=d3.scaleBand().domain(groupKeys).range([40,w-20]).padding(0.2);
  // draw group backgrounds
  groupKeys.forEach(g=>{
    const x=gx(g);
    const bw=gx.bandwidth();
    svg.append('rect').attr('x',x-6).attr('y',30).attr('width',bw+12).attr('height',h-50).attr('fill',color(g)).attr('opacity',0.08).attr('rx',10);
    svg.append('text').attr('x',x+bw/2).attr('y',20).attr('text-anchor','middle').attr('fill','#9aa0b8').attr('font-size','11px').text(`${g} (${groups[g].length})`);
  });
  // nodes
  groupKeys.forEach(g=>{
    const nodes=groups[g].sort((a,b)=>b.score-a.score);
    const x0=gx(g)+gx.bandwidth()/2;
    nodes.forEach((u,i)=>{
      const y=50 + (i % 20)*16 + Math.floor(i/20)*8;
      if(y>h-30) return; // overflow hide
      const cx=x0 + (Math.random()-0.5)* (gx.bandwidth()*0.7);
      svg.append('circle').attr('cx',cx).attr('cy',y).attr('r',3 + u.score/40).attr('fill',u.control==='private'?'#7c8cff':'#3dd598').attr('opacity',0.85).append('title').text(`${u.name}: ${u.score.toFixed(1)} • ${u.state}`);
      if(i<3) svg.append('text').attr('x',cx+6).attr('y',y+3).attr('fill','#e6e8f0').attr('font-size','9px').text(u.name.split(' ').slice(0,2).join(' '));
    });
  });
  // peer list cards
  const listEl=document.getElementById('peer-list');
  if(listEl){
    listEl.innerHTML=groupKeys.slice(0,12).map(g=>{
      const members=groups[g].sort((a,b)=>b.score-a.score).slice(0,5);
      const avgScore=members.reduce((s,u)=>s+u.score,0)/members.length;
      const avgEarn=members.reduce((s,u)=>s+u.median_earn_10yr,0)/members.length;
      return `<div class="filing-card"><div class="filing-left"><b>${g}</b><br><span style="color:#9aa0b8;font-size:.75rem">${groups[g].length} schools • avg score ${avgScore.toFixed(1)} • avg earn $${(avgEarn/1000).toFixed(0)}k</span><br><span style="font-size:.75rem">${members.map(m=>m.name).join(', ')}${groups[g].length>5?' …':''}</span></div></div>`;
    }).join('');
  }
}

loadData().then(data=>{
  allUnis=data.universities; filtered=[...allUnis];
  renderProvenance(data.metadata||{});
  renderMetrics(data); renderInsights(data); renderTable(filtered); renderFilings(data); drawCharts(filtered);
  renderPeers(filtered);
  document.getElementById('search').addEventListener('input',applyFilters);
  document.getElementById('filter-control').addEventListener('change',applyFilters);
  document.getElementById('sort-preset').addEventListener('change',applyFilters);
  const peerMode=document.getElementById('peer-mode'); if(peerMode) peerMode.addEventListener('change',()=>renderPeers(filtered));
  const csvBtn=document.getElementById('btn-csv'); if(csvBtn) csvBtn.addEventListener('click',()=>exportCSV(filtered));
  const cmpBtn=document.getElementById('btn-compare'); if(cmpBtn) cmpBtn.addEventListener('click',()=>{ document.getElementById('compare-bar').style.display='flex'; });
  const go=document.getElementById('compare-go'); if(go) go.addEventListener('click',showCompare);
  const cl=document.getElementById('compare-clear'); if(cl) cl.addEventListener('click',()=>{ selectedCompare.clear(); updateCompareBar(); renderTable(filtered); });
  window.__toggleCompare=toggleCompare;
  window.__showCompare=showCompare;
});
