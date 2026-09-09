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
- v0.14 (2026-09-06): **DONE** — endowment gap fill + absurd-value correction: 10 NACUBO-table assignments for v0.13-corrected identities (uva 11.23, georgia 2.18, kentucky 2.17, rochester 3.24, alabama 2.59 UA System scoped, oregonstate 1.01, southcarolina 1.15, auburn 1.31, udel 2.06 restored after delaware2 replacement orphaned it, umassamherst 1.80 system-scoped) + 8 absurd legacy synthetics replaced with publicly-verified values (usd 12.0→0.77 Wikipedia 2025, spelman 10.5→0.61 audited FY2025, morehouse 9.3→0.28 AP 2024, chapman 7.6→0.86 president address, northeastern 7.5→2.1 Wikipedia 2025, lmu 5.1→0.72 Wikipedia 2024 Loyola Marymount, ucd 4.1→2.2 UC Davis newsletter, byu 2.1→3.71 Wikipedia FY2025); 131/200 endowment real (was 113/200), remaining 69 explicitly labeled `synthetic (placeholder)`; raw sources in `data/raw/endowment-manual/2026-09-06/` (UCSB + UW-Seattle unverifiable this run — two search fetches failed, left synthetic)
- v0.15 (2026-09-07): **DONE** — verified endowment gap fill: 9 synthetic placeholders replaced with primary-source values, each verified against a document committed under `data/raw/endowment-manual/2026-09-07/` (virginiatech 2.09 NACUBO FY2025; kansasstate 1.0473 audited FY2025; dayton 0.919 official endowment page; wyoming 0.8574 audited FY2025 total-managed, scope-flagged incl. custodial; utahstate 0.64 Mar-2025 board memo "about $640 million", approximate; uvm 0.9725 FY2025 overview; macalester 0.92 facts sheet; wpi 0.7314 audited FY2025; usf 0.7228 audited FY2025); 140/200 endowment real (was 131/200), remaining 60 explicitly labeled `synthetic (placeholder)`; no score changes (endowment not in formula)
- v0.16 (2026-09-08): **DONE** — hbcusample identity cleanup: record displayed public name "HBCU Sample University" but carried scorecard_id 138947 = Clark Atlanta University, with baselines blended from another institution. Rematched to Clark Atlanta University (id renamed hbcusample→clarkatlanta; `_identity_source` annotated): name + control public→private (Scorecard ownership=2, UNCF), carnegie R1→R2 (CAU 2025 Carnegie announcement), enrollment_fte 33855→3603, grad_rate_6yr 0.72→0.4902 (both Scorecard real), retention 0.87→0.73 (CAU Office of Institutional Research; Scorecard retention field absent), sf_ratio 10→16 (College Board BigFuture 16:1, flagged for IPEDS-direct verification), research_spend_m 416→10.32 (CAU official: $10,320,000 FY2023), alumni_network_k 313→29 (UNCF "more than 29,000 alumni"), endowment_b 1.2 synthetic→0.116 (IPEDS Finance FY2024 ~$116M via Data USA, labeled non-NACUBO); endowment_per_student recomputed 32195; all 200 rescored (only CAU moved >0.05: 58.9→56.6). Raw artifacts: fresh Scorecard pull `data/raw/collegescorecard/2026-09-08/cau_138947_v16.json`, web-verified facts `data/raw/cau-rematch/2026-09-08/` (+ sources.json). 141/200 endowment real (was 140/200), 59 labeled synthetic placeholders. Data-quality flag: Scorecard `3_yr_default_rate` returned 0 for 138947 (implausible at 70% Pell — treated as suppressed; loan_default kept at 0.029 status quo, needs future audit)
- v0.17 (2026-09-09): **DONE** — identity/display-name correctness pass. (1) `oregon` identity rematch: record "University of Oregon" carried scorecard_id 209490 = Oregon Health & Science University (Portland), so earnings 101028, enrollment 836, debt 16625, net price 18000 were OHSU's. Rematched to 209551 = University of Oregon, Eugene (fresh Scorecard pull, raw artifact `data/raw/collegescorecard/2026-09-09/uo_209551_v17.json`, `_identity_source` annotated): earnings 61324, debt 20139, net price 22182, grad 0.7169, enrollment 20497, admission 0.883, pell 0.2135, family income 78050; retention field absent in pull — kept 0.87 status quo; `3_yr_default_rate` returned 0 (suppressed dataset-wide, same as CAU v0.16) — kept 0.039 placeholder, `loan_default_real` nulled; endowment_per_student recomputed 63424. All 200 rescored (only oregon moved >0.05: 78.5→64.4). (2) 20 malformed display names corrected (NYU University→New York University, UMD University→University of Maryland, Morehouse University→Morehouse College, Penn University→University of Pennsylvania, Case Western University→Case Western Reserve University, Tulane already correct; Scorecard formal names retained as source of truth). Validated: 200 records, 200/200 distinct ids/names/Scorecard IDs, valid JSON.
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
