# Enrichment scripts

- `enrich_scorecard.py` — College Scorecard API batch (DEMO_KEY works, or set DATA_GOV_API_KEY env)
  Usage: python3 scripts/enrich_scorecard.py
  It updates data/universities.json in place, preserving synthetic fallback where Scorecard suppressed.

Fields fetched:
- latest.earnings.10_yrs_after_entry.median
- latest.aid.median_debt.completers.overall
- latest.cost.avg_net_price.overall/public/private
- latest.student.size
- latest.admissions.admission_rate.overall
- latest.completion.retention_rate.four_year.full_time
- latest.student.demographics.avg_family_income
- latest.aid.pell_grant_rate

Proxy: uses https_proxy="http://b28e72297ea54364b447c3c06cb032db@hatch-egress-proxy:3128" for Hatch VM.

Future:
- ipeds_finance.py — IPEDS Finance API
- irs990.py — ProPublica Nonprofit Explorer IRS 990 XML
- nacubo.py — NACUBO endowment table scrape
- herd.py — NSF HERD Excel parser
