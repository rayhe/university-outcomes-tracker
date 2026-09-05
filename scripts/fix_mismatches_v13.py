#!/usr/bin/env python3
"""v0.13: identity-mismatch audit fix.

12 records carried Scorecard data from the wrong institution (satellite/branch/
different school). 13th: arizonastate2 (ASU-Northeastern Arizona regional, Show
Low) -> ASU main campus Tempe. All candidate IDs verified against the Scorecard
API (name/city) before applying. Then rescore all 200 with the v0.10 formula.
"""
import json, time, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from scorecard_api_v13 import api_get

FIXES = {
    "uconn": 129020,          # Univ of Connecticut Storrs (was Central CT State)
    "unm": 187985,           # UNM Main Campus Albuquerque (was NMSU Dona Ana)
    "uva": 234076,           # UVA Main Campus Charlottesville (was WVU Tech)
    "rochester": 195030,     # University of Rochester (was Rochester Christian)
    "oregonstate": 209542,   # Oregon State University Corvallis (was Western Oregon)
    "southcarolina": 218663, # USC Columbia (was USC Aiken)
    "kentucky": 157085,      # Univ of Kentucky Lexington (was Eastern Kentucky)
    "auburn": 100858,        # Auburn University (was Auburn Montgomery)
    "washstate": 236939,     # Washington State University Pullman (was Western Washington)
    "alabama": 100751,       # Univ of Alabama Tuscaloosa (was UA Huntsville)
    "udel": 130943,          # Univ of Delaware Newark (was Delaware State)
    "georgia": 139959,       # Univ of Georgia Athens (was GA Southwestern State)
    "arizonastate2": 104151, # ASU Tempe main (was ASU-Northeastern Arizona regional)
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
fixed = 0
for slug, sid in FIXES.items():
    uni = by_id.get(slug)
    if not uni:
        print(f"SKIP {slug}: not in JSON")
        continue
    try:
        j = api_get(f"id={sid}", fields=FULL_FIELDS, tag=f"scorecard-{sid}-{slug}.json",
                    note=f"v0.13 identity fix: {slug} -> correct main-campus institution {sid}")
        res = (j.get("results") or [None])[0]
    except Exception as e:
        print(f"  ERR {slug} id {sid}: {e}")
        continue
    if res is None:
        print(f"  NO RESULTS {slug} id {sid}")
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
        try:
            uni["retention"] = float(retention)
        except (TypeError, ValueError):
            pass
    if grad_rate:
        try:
            uni["grad_rate_6yr"] = float(grad_rate)
        except (TypeError, ValueError):
            pass
    if size:
        uni["enrollment_fte"] = int(size)
    if admit is not None:
        uni["admission_rate"] = float(admit)
    if avg_inc:
        uni["avg_family_income"] = int(avg_inc)
    if pell is not None:
        uni["pell_rate"] = float(pell)
    uni["scorecard_id"] = res.get("id")
    uni["scorecard_name"] = res.get("school.name")
    uni["scorecard_city"] = res.get("school.city")
    if res.get("school.state"):
        uni["state"] = res.get("school.state")
    fixed += 1
    print(f"  OK {slug} -> {res.get('school.name')} ({res.get('school.city')}) earn={earn10} grad={grad_rate} ret={retention}")
    time.sleep(0.7)

# distinct-ID sanity check
ids = [u["scorecard_id"] for u in data["universities"]]
dupes = sorted({i for i in ids if ids.count(i) > 1})
print(f"fixed={fixed} distinct_ids={len(set(ids))}/200 dupes={dupes}")

# rescore all 200 with v0.10 formula (same components, min-max [55,97])
def raw_score(u):
    earn = u.get("median_earn_10yr") or 50000
    gr = u.get("grad_rate_6yr") or 0.6
    ret = u.get("retention") or 0.8
    adm = u.get("admission_rate")
    adm = 0.7 if adm is None else adm
    b = 60 + (earn - 45000) / 1200 * 0.8 + gr * 15 + ret * 8 + (1 - adm) * 6
    if u.get("control") == "private" and u.get("carnegie") == "Baccalaureate":
        b += 3
    return b

unis = data["universities"]
assert len(unis) == 200, len(unis)
raws = [(u, raw_score(u)) for u in unis]
lo = min(r for _, r in raws); hi = max(r for _, r in raws)
for u, r in raws:
    u["score"] = round(55.0 + (r - lo) / (hi - lo) * 42.0, 1)

top = sorted(unis, key=lambda x: -x["score"])[:5]
print("top 5:", [(u["id"], u["score"]) for u in top])
fixed_rec = sorted([by_id[s] for s in FIXES if s in by_id], key=lambda x: -x["score"])
print("fixed records:", [(u["id"], u["score"], u["median_earn_10yr"]) for u in fixed_rec])

data["metadata"]["last_updated"] = "2026-09-05"
data["metadata"]["version"] = "0.13"
data["metadata"]["identity_fix_v13"] = fixed

with open(path, "w") as out:
    json.dump(data, out, indent=1)
print(f"wrote {path}")
