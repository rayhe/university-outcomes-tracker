# University Outcomes & Alumni Advantage Tracker

How well universities convert resources into alumni success — modeled after the [S&P 500 Executive Compensation Tracker](https://rayhe.github.io/sp500-exec-comp).

**Live:** https://rayhe.github.io/university-outcomes-tracker  
**Data:** 200 universities v0.10 (200/200 Scorecard-real 100%, 200/200 distinct IDs, 36 conferences, 12 LACs, score formula declamped 55-97)
**Update cadence:** Hourly until 9.0+ quality, then daily

## What It Measures

Composite **Alumni Advantage Score (0-100)** = weighted sum of:

1. **Career Outcomes (30%)** — median earnings 10yr (College Scorecard), employment 6mo, grad school rate, Fortune 500 alumni %, startup founders per 1k
2. **Alumni Support & Network (20%)** — alumni giving rate, endowment per student (NACUBO/IPEDS), network size, career services score
3. **Academic Quality (15%)** — 6yr grad rate, retention, student-faculty ratio, research spend per student (NSF HERD)
4. **Financial Health (15%)** — endowment 5yr growth, tuition reliance (990/audited), state appropriation stability, credit rating
5. **Value & ROI (20%)** — net price low-income, Pell gap, loan default rate, debt at graduation, 10yr ROI

6. **Public Filings (trust signal, unweighted)** — IPEDS, IRS 990, audited financials, College Scorecard, NSF HERD, state audit

## Public Filings Sources

| Source | What | Where |
|---|---|---|
| **IPEDS** | Enrollment, grad rate, retention, finance, SF ratio, state appropriation | NCES IPEDS Use-the-Data API |
| **IRS 990** | Revenue, expenses, endowment Schedule D, exec comp | ProPublica Nonprofit Explorer / IRS 990 XML |
| **Audited Financials** | GAAP financials, endowment footnotes | University controller sites |
| **College Scorecard** | Earnings, debt, default, net price, Pell | data.ed.gov Scorecard API |
| **NSF HERD** | Research expenditures | NSF HERD survey |
| **State Audit** | Public university single audit | State auditor |

Filing presence is a **trust signal**, not a score weight — similar to how DEF 14A completeness signals data quality in the S&P tracker.

## Roadmap

- v0.1 (now): 60 universities, synthetic enrichment, full UI, methodology
- v0.2 (hour +1): Replace synthetic earnings with College Scorecard API batch, add direct IPEDS Finance API
- v0.3 (hour +2): IRS 990 XML enrichment via ProPublica, NACUBO endowment table scrape, HERD Excel parser
- v0.4: Add 140 more universities (200 total), peer network (conference / Carnegie / geography), trends — **DONE v0.7 200/200 real**
- v0.12 (2026-09-04): **DONE** — endowment_b now NACUBO 2025 NCSE FY2025 real for 114/200 (explicit hand-adjudicated allowlist; system/foundation figures flagged via `_endowment_scope`; raw fetch artifacts in `data/raw/wikipedia-endowment/`)
- v0.5: Alumni network via LinkedIn alumni search (Fortune 500 %), startup founder enrichment (Crunchbase)
- v1.0: 500 universities, 6 filing sources 100% coverage, 5-critic panel 9.0+

## Iteration Loop

Same as S&P 500 tracker:

1. **Review** current site (index.html, css, js, data)
2. **Panel-evaluate** 5 critics: Data Richness, Visual Design, Interactivity, Network Quality, Analytical Depth
3. **Pick highest-impact fix**, implement in one run
4. **Commit & push** to `master`, GitHub Pages auto-deploys
5. **Log** to `hidden_files/iteration-log.md`

Cron: `university-outcomes-iteration` every 1h until avg 9.0+, then switch to 24h.

## Local Dev

```bash
cd ~/repos/university-outcomes-tracker
python3 -m http.server 8000
# open http://localhost:8000
```

## License

MIT — data from public sources, methodology documented.
