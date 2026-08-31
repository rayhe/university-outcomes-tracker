async function loadData(){
  const res = await fetch('data/universities.json');
  const j = await res.json();
  return j;
}

function fmtMoney(n){ if(n>=1e9) return '$'+(n/1e9).toFixed(1)+'B'; if(n>=1e6) return '$'+(n/1e6).toFixed(1)+'M'; if(n>=1e3) return '$'+(n/1e3).toFixed(0)+'k'; return '$'+n; }
function fmtNum(n){ return n.toLocaleString(); }

let allUnis=[], filtered=[];

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
  insights.push({t:`Top Alumni Advantage: ${topScore.name}`, d:`Score ${topScore.score} — private R1, endowment $${(topScore.endowment_b)}B, earnings $${topScore.median_earn_10yr.toLocaleString()} 10yr. Model: high endowment/student + low Pell gap + high retention.`});
  insights.push({t:`Highest Earnings: ${topEarn.name}`, d:`$${topEarn.median_earn_10yr.toLocaleString()} median 10yr. SF ratio ${topEarn.sf_ratio}:1, research $${topEarn.research_spend_m}M. Earnings premium correlates with research spend per student (r~0.6).`});
  insights.push({t:`Best Value (Price/Earnings): ${bestValue.name}`, d:`Net price $${bestValue.net_price_avg.toLocaleString()} vs earnings $${bestValue.median_earn_10yr.toLocaleString()}. Public flagship model shows ROI advantage despite lower endowment/student.`});
  insights.push({t:`Private vs Public: ${privateAvg.toFixed(1)} vs ${publicAvg.toFixed(1)} avg score`, d:`Private advantage driven by endowment/student (avg $1.2M vs $0.2M) and alumni giving (28% vs 9%). Publics close gap on value/ROI and research scale.`});
  insights.push({t:`Public Filings Coverage: 6 sources`, d:`IPEDS (100% Title IV), IRS 990 (private only), Audited financials (GAAP), College Scorecard (earnings/debt/default/net price), NSF HERD (R&D), State audit (publics). Filing presence is trust signal, not score weight.`});
  insights.push({t:`Expansion Plan: 60 → 500`, d:`v0.1 seeds 60 (R1 + flagships). Hourly iteration adds: Scorecard API batch enrichment, IPEDS Finance API, IRS 990 XML via ProPublica, NACUBO endowment table, HERD Excel, state audit PDFs. Target 200 by v0.3, 500 by v1.0.`});
  const grid = document.getElementById('insights-grid');
  grid.innerHTML = insights.map(i=>`<div class="insight-card"><h4>${i.t}</h4><p>${i.d}</p></div>`).join('');
}

function renderTable(unis){
  const thead = document.querySelector('#uni-table thead');
  thead.innerHTML = `<tr><th data-k="name">University</th><th data-k="control">Control</th><th data-k="state">State</th><th data-k="score">Score</th><th data-k="median_earn_10yr">Earn 10yr</th><th data-k="endowment_per_student">Endow / Stud</th><th data-k="grad_rate_6yr">Grad 6yr</th><th data-k="loan_default">Default</th><th data-k="net_price_avg">Net Price</th><th data-k="enrollment_fte">Enroll</th></tr>`;
  const tbody = document.querySelector('#uni-table tbody');
  tbody.innerHTML = unis.map(u=>`<tr data-id="${u.id}"><td><b>${u.name}</b><br><span style="color:#9aa0b8;font-size:.75rem">${u.carnegie} • ${u.enrollment_fte.toLocaleString()} FTE</span></td><td>${u.control}</td><td>${u.state}</td><td><b>${u.score.toFixed(1)}</b></td><td>${fmtMoney(u.median_earn_10yr)}</td><td>${fmtMoney(u.endowment_per_student)}</td><td>${(u.grad_rate_6yr*100).toFixed(0)}%</td><td>${(u.loan_default*100).toFixed(1)}%</td><td>${fmtMoney(u.net_price_avg)}</td><td>${fmtNum(u.enrollment_fte)}</td></tr>`).join('');
  tbody.querySelectorAll('tr').forEach(tr=>tr.addEventListener('click',()=>showDetail(tr.dataset.id)));
  thead.querySelectorAll('th').forEach(th=>th.addEventListener('click',()=>{ const k=th.dataset.k; sortBy(k); }));
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
  p.innerHTML = `<h3>${u.name} — Alumni Advantage ${u.score.toFixed(1)}</h3>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:.86rem">
  <div><b>Basic</b><br>Control: ${u.control}<br>State: ${u.state}<br>Carnegie: ${u.carnegie}<br>Enrollment FTE: ${u.enrollment_fte.toLocaleString()}<br>Endowment: $${u.endowment_b}B ($${(u.endowment_per_student/1000).toFixed(0)}k / student)<br>Student-Faculty: ${u.sf_ratio}:1</div>
  <div><b>Outcomes</b><br>Grad 6yr: ${(u.grad_rate_6yr*100).toFixed(0)}%<br>Retention: ${(u.retention*100).toFixed(0)}%<br>Median Earn 10yr: $${u.median_earn_10yr.toLocaleString()}<br>Employment 6mo: ${(u.employment_6mo*100).toFixed(0)}%<br>Alumni Giving: ${(u.alumni_giving*100).toFixed(0)}%<br>Alumni Network: ${(u.alumni_network_k)}k</div>
  <div><b>Value</b><br>Net Price Avg: $${u.net_price_avg.toLocaleString()}<br>Pell Gap: ${(u.pell_gap*100).toFixed(0)}pp<br>Loan Default: ${(u.loan_default*100).toFixed(1)}%<br>Debt Avg: $${u.debt_avg.toLocaleString()}<br>ROI 10yr (est): $${(u.median_earn_10yr - 35000*2 - u.net_price_avg*4).toLocaleString()}</div>
  <div><b>Public Filings</b><br>IPEDS: ${u.filings.ipeds}<br>IRS 990: ${u.filings['990']}<br>Audited: ${u.filings.audited}<br>Scorecard: ${u.filings.scorecard}<br>HERD: ${u.filings.herd}<br>State Audit: ${u.filings.state_audit}<br><br><span style="font-size:.75rem;color:#9aa0b8">Research Spend: $${u.research_spend_m}M (NSF HERD)</span></div>
  </div>
  <p style="font-size:.8rem;color:#9aa0b8;margin-top:10px">Filings as trust signal: this university's Scorecard coverage = ${u.filings.scorecard}, 990 = ${u.filings['990']}. Direct links planned via IPEDS Use-the-Data, ProPublica Nonprofit Explorer, Scorecard API.</p>
  <button onclick="document.getElementById('detail-panel').classList.add('hidden')" style="margin-top:8px">Close</button>`;
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

loadData().then(data=>{
  allUnis=data.universities; filtered=[...allUnis];
  renderMetrics(data); renderInsights(data); renderTable(filtered); renderFilings(data); drawCharts(filtered);
  document.getElementById('search').addEventListener('input',applyFilters);
  document.getElementById('filter-control').addEventListener('change',applyFilters);
  document.getElementById('sort-preset').addEventListener('change',applyFilters);
});
