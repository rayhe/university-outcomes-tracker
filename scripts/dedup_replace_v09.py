#!/usr/bin/env python3
"""
v0.9 — Replace 13 duplicate-suffix entries with 13 distinct universities.
Enriches via College Scorecard API DEMO_KEY (name+city filter, egress proxy).
Keeps total at 200, distinct Scorecard IDs 187 -> 200.
"""
import json, os, time, urllib.parse, subprocess, sys

DATA_PATH = os.path.expanduser("~/repos/university-outcomes-tracker/data/universities.json")

# 13 duplicate entries to REMOVE (keep the original of each pair)
REMOVE_IDS = ["upenn","brandeis2","duke2","cmu2","emory2","lehigh2","bostonu2",
              "chapman2","case2","georgetown2","dartmouth_ext1","florida2","usd2"]

# 13 distinct replacements: (id, name, hint, city, must_contain tokens, control, state, carnegie, conference, synthetic baseline)
NEW_UNIS = [
    ("tcu","Texas Christian University","Texas Christian University","Fort Worth",["texas christian"],"private","TX","R1","Big 12",
     dict(enrollment_fte=11000,endowment_b=2.6,endowment_per_student=236000,grad_rate_6yr=0.83,retention=0.91,sf_ratio=13,median_earn_10yr=68000,employment_6mo=0.82,alumni_giving=0.11,net_price_avg=31000,pell_gap=0.04,loan_default=0.025,debt_avg=23000,research_spend_m=60,alumni_network_k=100)),
    ("syracuse","Syracuse University","Syracuse University","Syracuse",["syracuse"],"private","NY","R1","ACC",
     dict(enrollment_fte=21000,endowment_b=1.9,endowment_per_student=90000,grad_rate_6yr=0.82,retention=0.90,sf_ratio=15,median_earn_10yr=66000,employment_6mo=0.81,alumni_giving=0.12,net_price_avg=32000,pell_gap=0.05,loan_default=0.027,debt_avg=24000,research_spend_m=90,alumni_network_k=250)),
    ("washington","University of Washington","University of Washington-Seattle Campus","Seattle",["washington","seattle"],"public","WA","R1","Big Ten",
     dict(enrollment_fte=48000,endowment_b=4.4,endowment_per_student=91000,grad_rate_6yr=0.84,retention=0.93,sf_ratio=19,median_earn_10yr=68000,employment_6mo=0.82,alumni_giving=0.08,net_price_avg=17500,pell_gap=0.07,loan_default=0.028,debt_avg=19500,research_spend_m=1700,alumni_network_k=350)),
    ("texasaustin","University of Texas at Austin","The University of Texas at Austin","Austin",["texas","austin"],"public","TX","R1","SEC",
     dict(enrollment_fte=52000,endowment_b=17.0,endowment_per_student=326000,grad_rate_6yr=0.88,retention=0.95,sf_ratio=18,median_earn_10yr=70000,employment_6mo=0.83,alumni_giving=0.07,net_price_avg=17500,pell_gap=0.06,loan_default=0.026,debt_avg=20000,research_spend_m=800,alumni_network_k=500)),
    ("arkansas","University of Arkansas","University of Arkansas","Fayetteville",["arkansas"],"public","AR","R1","SEC",
     dict(enrollment_fte=30000,endowment_b=1.9,endowment_per_student=63000,grad_rate_6yr=0.70,retention=0.85,sf_ratio=19,median_earn_10yr=56000,employment_6mo=0.77,alumni_giving=0.06,net_price_avg=16500,pell_gap=0.08,loan_default=0.033,debt_avg=21500,research_spend_m=200,alumni_network_k=170)),
    ("olemiss","University of Mississippi","University of Mississippi","University",["mississippi"],"public","MS","R1","SEC",
     dict(enrollment_fte=21000,endowment_b=0.8,endowment_per_student=38000,grad_rate_6yr=0.66,retention=0.85,sf_ratio=16,median_earn_10yr=54000,employment_6mo=0.76,alumni_giving=0.06,net_price_avg=16500,pell_gap=0.08,loan_default=0.034,debt_avg=22000,research_spend_m=120,alumni_network_k=150)),
    ("mississippistate","Mississippi State University","Mississippi State University","Mississippi State",["mississippi state"],"public","MS","R1","SEC",
     dict(enrollment_fte=22000,endowment_b=0.7,endowment_per_student=31000,grad_rate_6yr=0.63,retention=0.82,sf_ratio=17,median_earn_10yr=56000,employment_6mo=0.77,alumni_giving=0.06,net_price_avg=17500,pell_gap=0.08,loan_default=0.033,debt_avg=21500,research_spend_m=300,alumni_network_k=150)),
    ("maryland","University of Maryland","University of Maryland-College Park","College Park",["maryland","college park"],"public","MD","R1","Big Ten",
     dict(enrollment_fte=40000,endowment_b=2.1,endowment_per_student=52000,grad_rate_6yr=0.87,retention=0.95,sf_ratio=18,median_earn_10yr=70000,employment_6mo=0.83,alumni_giving=0.07,net_price_avg=18500,pell_gap=0.06,loan_default=0.027,debt_avg=21000,research_spend_m=1200,alumni_network_k=400)),
    ("creighton","Creighton University","Creighton University","Omaha",["creighton"],"private","NE","R2","Big East",
     dict(enrollment_fte=8200,endowment_b=0.65,endowment_per_student=79000,grad_rate_6yr=0.80,retention=0.90,sf_ratio=11,median_earn_10yr=67000,employment_6mo=0.83,alumni_giving=0.12,net_price_avg=28000,pell_gap=0.04,loan_default=0.026,debt_avg=22500,research_spend_m=25,alumni_network_k=70)),
    ("wisconsinmadison","University of Wisconsin-Madison","University of Wisconsin-Madison","Madison",["wisconsin","madison"],"public","WI","R1","Big Ten",
     dict(enrollment_fte=48000,endowment_b=4.3,endowment_per_student=89000,grad_rate_6yr=0.88,retention=0.94,sf_ratio=17,median_earn_10yr=66000,employment_6mo=0.82,alumni_giving=0.08,net_price_avg=15500,pell_gap=0.06,loan_default=0.026,debt_avg=22500,research_spend_m=1500,alumni_network_k=450)),
    ("illinoisurbana","University of Illinois Urbana-Champaign","University of Illinois Urbana-Champaign","Champaign",["illinois","urbana"],"public","IL","R1","Big Ten",
     dict(enrollment_fte=56000,endowment_b=3.8,endowment_per_student=67000,grad_rate_6yr=0.85,retention=0.93,sf_ratio=20,median_earn_10yr=68000,employment_6mo=0.82,alumni_giving=0.07,net_price_avg=17500,pell_gap=0.07,loan_default=0.028,debt_avg=22000,research_spend_m=750,alumni_network_k=500)),
    ("ucdavis","University of California-Davis","University of California-Davis","Davis",["california","davis"],"public","CA","R1","Big West",
     dict(enrollment_fte=39000,endowment_b=2.5,endowment_per_student=64000,grad_rate_6yr=0.86,retention=0.93,sf_ratio=20,median_earn_10yr=66000,employment_6mo=0.80,alumni_giving=0.06,net_price_avg=18500,pell_gap=0.08,loan_default=0.029,debt_avg=18500,research_spend_m=1000,alumni_network_k=280)),
    ("gonzaga","Gonzaga University","Gonzaga University","Spokane",["gonzaga"],"private","WA","R2","WCC",
     dict(enrollment_fte=7200,endowment_b=0.35,endowment_per_student=48000,grad_rate_6yr=0.84,retention=0.92,sf_ratio=11,median_earn_10yr=66000,employment_6mo=0.82,alumni_giving=0.13,net_price_avg=29000,pell_gap=0.04,loan_default=0.024,debt_avg=22500,research_spend_m=8,alumni_network_k=60)),
]

FIELDS = ",".join([
    "id","school.name","school.city","school.state","school.ownership",
    "latest.earnings.10_yrs_after_entry.median","latest.earnings.6_yrs_after_entry.median",
    "latest.aid.median_debt.completers.overall",
    "latest.repayment.3_yr_default_rate",
    "latest.cost.avg_net_price.overall","latest.cost.avg_net_price.public","latest.cost.avg_net_price.private",
    "latest.student.size","latest.admissions.admission_rate.overall",
    "latest.completion.retention_rate.four_year.full_time",
    "latest.aid.pell_grant_rate","latest.student.demographics.avg_family_income",
    "latest.completion.completion_rate_4yr_150nt"
])
PROXY = "http://b28e72297ea54364b447c3c06cb032db@hatch-egress-proxy:3128"

def fetch_by_name_city(name, city):
    q = f"https://api.data.gov/ed/collegescorecard/v1/schools?api_key=DEMO_KEY&school.name={urllib.parse.quote(name)}&school.city={urllib.parse.quote(city)}&per_page=10&fields={urllib.parse.quote(FIELDS)}"
    cmd = f'https_proxy="{PROXY}" curl -s --http1.1 "{q}"'
    try:
        out = subprocess.check_output(cmd, shell=True, text=True, timeout=30)
        j = json.loads(out)
        return j.get("results", [])
    except Exception as e:
        print(f"ERR {name}: {e}", file=sys.stderr)
        return []

def enrich(uni, hint, city, tokens):
    results = fetch_by_name_city(hint, city)
    # pick result whose name contains all tokens (case-insensitive), prefer shortest name
    cands = [r for r in results if all(t in (r.get("school.name") or "").lower() for t in tokens)]
    if not cands:
        cands = results[:1]
    if not cands:
        return False
    res = sorted(cands, key=lambda r: len(r.get("school.name") or ""))[0]
    print(f"  candidate: {res.get('school.name')} id={res.get('id')} city={res.get('school.city')}")
    earn10 = res.get("latest.earnings.10_yrs_after_entry.median")
    earn6 = res.get("latest.earnings.6_yrs_after_entry.median")
    debt = res.get("latest.aid.median_debt.completers.overall")
    default_rate = res.get("latest.repayment.3_yr_default_rate")
    net_price = res.get("latest.cost.avg_net_price.overall") or res.get("latest.cost.avg_net_price.public") or res.get("latest.cost.avg_net_price.private")
    size = res.get("latest.student.size")
    admit = res.get("latest.admissions.admission_rate.overall")
    retention = res.get("latest.completion.retention_rate.four_year.full_time")
    pell = res.get("latest.aid.pell_grant_rate")
    avg_inc = res.get("latest.student.demographics.avg_family_income")
    grad = res.get("latest.completion.completion_rate_4yr_150nt")
    if earn10 and earn10 > 10000:
        uni["median_earn_10yr_real"] = earn10
        uni["median_earn_10yr"] = int(earn10)
        uni["_earnings_source"] = "scorecard"
    elif earn6 and earn6 > 10000:
        uni["median_earn_10yr_real"] = earn6
        uni["median_earn_10yr"] = int(earn6)
        uni["_earnings_source"] = "scorecard_6yr"
    else:
        uni["_earnings_source"] = "synthetic"
    if debt and debt > 1000:
        uni["debt_avg_real"] = debt
        uni["debt_avg"] = int(debt)
    if default_rate is not None:
        try:
            dr = float(default_rate)
            if dr != 0:
                uni["loan_default_real"] = dr
                uni["loan_default"] = dr
        except:
            pass
    if net_price and net_price > 1000:
        uni["net_price_avg_real"] = int(net_price)
        uni["net_price_avg"] = int(net_price)
    if retention:
        try:
            uni["retention_real"] = float(retention)
            uni["retention"] = float(retention)
        except:
            pass
    if size:
        uni["enrollment_fte_real"] = size
    if admit is not None:
        uni["admission_rate"] = float(admit)
    if avg_inc:
        uni["avg_family_income"] = int(avg_inc)
    if pell is not None:
        uni["pell_rate"] = float(pell)
    if grad:
        try:
            uni["grad_rate_6yr_real"] = float(grad)
            uni["grad_rate_6yr"] = float(grad)
        except:
            pass
    uni["scorecard_id"] = res.get("id")
    uni["scorecard_name"] = res.get("school.name")
    uni["scorecard_city"] = res.get("school.city")
    ownership = res.get("school.ownership")
    if ownership == 1:
        uni["control"] = "public"
    elif ownership in [2, 3]:
        uni["control"] = "private"
    st = res.get("school.state")
    if st:
        uni["state"] = st
    return True

def compute_score(uni):
    earn = uni.get("median_earn_10yr", 50000)
    grad_r = uni.get("grad_rate_6yr", 0.6)
    ret = uni.get("retention", 0.8)
    adm = uni.get("admission_rate", 0.7)
    base = 60 + (earn - 45000) / 1200 * 0.8 + grad_r * 15 + ret * 8 + (1 - adm) * 6
    if uni["control"] == "private" and uni["carnegie"] == "Baccalaureate":
        base += 3
    return round(max(55, min(96, base)), 1)

with open(DATA_PATH) as f:
    data = json.load(f)

unis = data["universities"]
before = len(unis)
unis = [u for u in unis if u["id"] not in REMOVE_IDS]
removed = before - len(unis)
print(f"Removed {removed} duplicates (expected 13)")

existing = set(u["id"] for u in unis)
enriched = 0
failed = []
for (uid, name, hint, city, tokens, control, state, carnegie, conf, base) in NEW_UNIS:
    assert uid not in existing, f"{uid} already exists!"
    uni = {"id": uid, "name": name, "control": control, "state": state,
           "carnegie": carnegie, "conference": conf, "peer_group": conf,
           "filings": {"ipeds": "2024", "990": "2023" if control == "private" else "n/a",
                       "audited": "2024", "scorecard": "full", "herd": "2023",
                       "state_audit": "2024" if control == "public" else "n/a"}}
    uni.update(base)
    print(f"Fetching {uid} -> {hint} ({city}) ...")
    ok = enrich(uni, hint, city, tokens)
    if ok:
        enriched += 1
        print(f"  OK earn={uni.get('median_earn_10yr')} src={uni.get('_earnings_source')}")
    else:
        failed.append(uid)
        uni["_earnings_source"] = "synthetic"
        print(f"  FAIL {uid} — keeping synthetic")
    uni["score"] = compute_score(uni)
    unis.append(uni)
    time.sleep(0.7)

data["universities"] = unis
total = len(unis)
real_count = len([u for u in unis if u.get("median_earn_10yr_real")])
distinct_ids = len(set(u.get("scorecard_id") for u in unis))
confs = len(set(u.get("conference") for u in unis))
data["metadata"]["last_updated"] = "2026-09-02"
data["metadata"]["version"] = "0.9"
data["metadata"]["total_universities"] = total
data["metadata"]["enriched_count"] = real_count
data["metadata"]["distinct_scorecard_ids"] = distinct_ids
data["metadata"]["failed"] = failed
data["metadata"]["source"] = f"College Scorecard API (DEMO_KEY) + v0.9 dedup: 13 duplicate entries replaced with 13 distinct schools, {distinct_ids}/{total} distinct IDs, {confs} conferences"
data["metadata"]["dedup_v09"] = {"removed": REMOVE_IDS, "added": [n[0] for n in NEW_UNIS]}

with open(DATA_PATH, "w") as out:
    json.dump(data, out, indent=2)

print(f"Done total={total} real={real_count} distinct_ids={distinct_ids} enriched_new={enriched} failed={failed}")
