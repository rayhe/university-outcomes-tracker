#!/usr/bin/env python3
"""v0.13b: replace the 3 now-identical suffix duplicates (left by v0.13 identity
fix) with 3 distinct universities, v0.9 dedup precedent.
- arizonastate2 -> umassamherst (UMass Amherst 166629, MAC)
- connecticut2  -> ucdavis (UC Davis 110644, Big West)
- delaware2     -> fresnostate (Fresno State 110556, Mountain West)
Candidate IDs verified via Scorecard API name/city before applying.
"""
import json, time, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from scorecard_api_v13 import api_get

REPLACEMENTS = {
    "arizonastate2": {
        "new_id": "umassamherst", "sid": 166629, "expect": "University of Massachusetts-Amherst",
        "name": "UMass Amherst", "control": "public", "state": "MA", "carnegie": "R1",
        "conference": "MAC", "peer_group": "MAC",
    },
    "ucdavis": {
        "new_id": "utahstate", "sid": 230728, "expect": "Utah State University",
        "name": "Utah State", "control": "public", "state": "UT", "carnegie": "R1",
        "conference": "Mountain West", "peer_group": "Mountain West",
    },
    "delaware2": {
        "new_id": "fresnostate", "sid": 110556, "expect": "California State University-Fresno",
        "name": "Fresno State", "control": "public", "state": "CA", "carnegie": "R2",
        "conference": "Mountain West", "peer_group": "Mountain West",
    },
}

FULL_FIELDS = [
    "id","school.name","school.city","school.state","school.ownership",
    "latest.earnings.10_yrs_after_entry.median","latest.earnings.6_yrs_after_entry.median",
    "latest.aid.median_debt.completers.overall","latest.repayment.3_yr_default_rate",
    "latest.cost.avg_net_price.overall","latest.cost.avg_net_price.public","latest.cost.avg_net_price.private",
    "latest.completion.completion_rate_4yr_150nt","latest.completion.rate_suppressed.overall",
    "latest.student.size","latest.admissions.admission_rate.overall",
    "latest.completion.retention_rate.four_year.full_time","latest.aid.federal_loan_rate",
    "latest.aid.pell_grant_rate","latest.student.demographics.avg_family_income",
]

path = os.path.expanduser("~/repos/university-outcomes-tracker/data/universities.json")
with open(path) as f:
    data = json.load(f)

by_id = {u["id"]: u for u in data["universities"]}

for old_id, cfg in REPLACEMENTS.items():
    uni = by_id.get(old_id)
    if not uni:
        print(f"SKIP {old_id}: not found")
        continue
    try:
        j = api_get(f"id={cfg['sid']}", fields=FULL_FIELDS, tag=f"scorecard-{cfg['sid']}-{cfg['new_id']}.json",
                    note=f"v0.13b dedup replacement: {old_id} -> {cfg['new_id']}")
        res = (j.get("results") or [None])[0]
    except Exception as e:
        print(f"  ERR {old_id}: {e}")
        continue
    name = (res or {}).get("school.name", "")
    if cfg["expect"] not in name and not name.startswith(cfg["expect"].split(",")[0]):
        print(f"  !! ID VERIFY FAILED {old_id} sid {cfg['sid']} -> {name}; skipping")
        continue
    earn10 = res.get("latest.earnings.10_yrs_after_entry.median")
    debt = res.get("latest.aid.median_debt.completers.overall")
    default_rate = res.get("latest.repayment.3_yr_default_rate")
    net_price = (res.get("latest.cost.avg_net_price.overall")
                 or res.get("latest.cost.avg_net_price.public")
                 or res.get("latest.cost.avg_net_price.private"))
    grad_rate = (res.get("latest.completion.rate_suppressed.overall")
                 or res.get("latest.completion.completion_rate_4yr_150nt"))
    size = res.get("latest.student.size")
    retention = res.get("latest.completion.retention_rate.four_year.full_time")
    admit = res.get("latest.admissions.admission_rate.overall")
    avg_inc = res.get("latest.student.demographics.avg_family_income")
    pell = res.get("latest.aid.pell_grant_rate")
    # reset identity
    uni["id"] = cfg["new_id"]
    uni["name"] = cfg["name"]
    uni["control"] = cfg["control"]
    uni["state"] = cfg["state"]
    uni["carnegie"] = cfg["carnegie"]
    uni["conference"] = cfg["conference"]
    uni["peer_group"] = cfg["peer_group"]
    if earn10 and earn10 > 10000:
        uni["median_earn_10yr_real"] = int(earn10); uni["median_earn_10yr"] = int(earn10)
        uni["_earnings_source"] = "scorecard"
    if debt and debt > 1000:
        uni["debt_avg_real"] = int(debt); uni["debt_avg"] = int(debt)
    if default_rate is not None:
        try:
            v = float(default_rate)
            if v > 0:
                uni["loan_default_real"] = v; uni["loan_default"] = v
        except (TypeError, ValueError):
            pass
    if net_price and net_price > 1000:
        uni["net_price_avg_real"] = int(net_price); uni["net_price_avg"] = int(net_price)
    if retention:
        try: uni["retention"] = float(retention)
        except (TypeError, ValueError): pass
    if grad_rate:
        try: uni["grad_rate_6yr"] = float(grad_rate)
        except (TypeError, ValueError): pass
    if size:
        uni["enrollment_fte"] = int(size)
    if admit is not None:
        uni["admission_rate"] = float(admit)
    if avg_inc:
        uni["avg_family_income"] = int(avg_inc)
    if pell is not None:
        uni["pell_rate"] = float(pell)
    # synthetic leftovers that are campus-specific get neutral placeholders
    uni["endowment_b"] = 1.0
    uni["endowment_per_student"] = 25000
    uni["_endowment_source"] = "synthetic (placeholder)"
    uni["research_spend_m"] = 200
    uni["alumni_giving"] = 0.10
    uni["employment_6mo"] = 0.80
    uni["scorecard_id"] = res.get("id")
    uni["scorecard_name"] = res.get("school.name")
    uni["scorecard_city"] = res.get("school.city")
    print(f"  OK {old_id} -> {cfg['new_id']}: {name} ({res.get('school.city')}) earn={earn10}")
    time.sleep(0.7)

ids = [u["scorecard_id"] for u in data["universities"]]
dupes = sorted({i for i in ids if ids.count(i) > 1})
print(f"distinct_ids={len(set(ids))}/200 dupes={dupes}")

with open(path, "w") as out:
    json.dump(data, out, indent=1)
print("wrote", path)
