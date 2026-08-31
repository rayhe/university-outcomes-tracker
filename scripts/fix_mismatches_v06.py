import json, os, time, subprocess, urllib.parse, sys
# Fix remaining Scorecard mismatches - v0.6
# Priority: Data correctness > all

# Map of university id -> correct Scorecard ID (verified via College Scorecard)
# These IDs are stable and more reliable than name search
CORRECT_IDS = {
    "northwestern": 147767,  # Northwestern University, Evanston IL
    "usc": 123961,           # University of Southern California, Los Angeles
    "purdue": 243780,        # Purdue University-Main Campus, West Lafayette IN
    "bostoncolleg": 164924,  # Boston College, Chestnut Hill MA
    "nyu": 193900,           # New York University, New York NY
    "ncstate": 199193,       # North Carolina State University at Raleigh
    "georgiastate": 139940,  # Georgia State University, Atlanta GA
    "kansasstate": 155399,   # Kansas State University, Manhattan KS
    "lsu": 159391,           # Louisiana State University and A&M College, Baton Rouge
    "missouri": 178396,      # University of Missouri-Columbia
    "oklahomastate": 207209,  # Oklahoma State University-Main Campus, Stillwater
    "rutgers": 186380,       # Rutgers University-New Brunswick
    "asu": 104151,           # Arizona State University Campus Immersion (Tempe)
    "connecticut2": 129020,  # University of Connecticut, Storrs (rename duplicate)
    "texasa&m": 228723,      # Texas A&M already correct, keep
}

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

def fetch_by_id(sid):
    base = f"https://api.data.gov/ed/collegescorecard/v1/schools?api_key=DEMO_KEY&id={sid}&fields={urllib.parse.quote(FIELDS)}"
    cmd = f'https_proxy="http://b28e72297ea54364b447c3c06cb032db@hatch-egress-proxy:3128" curl -s --http1.1 "{base}"'
    try:
        out = subprocess.check_output(cmd, shell=True, text=True, timeout=25)
        j = json.loads(out)
        if j.get("results"):
            return j["results"][0]
    except Exception as e:
        print(f"ERR id {sid}: {e}", file=sys.stderr)
    return None

path = os.path.expanduser("~/repos/university-outcomes-tracker/data/universities.json")
with open(path) as f:
    data=json.load(f)

fixed=0
for uni in data["universities"]:
    uid = uni["id"]
    if uid not in CORRECT_IDS:
        continue
    correct_id = CORRECT_IDS[uid]
    print(f"Fetching {uid} -> Scorecard ID {correct_id} ...")
    res = fetch_by_id(correct_id)
    if not res:
        print(f"  FAIL {uid} id {correct_id}")
        continue
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

    # Use 10yr if available, else 6yr fallback, preserve original if both missing
    if earn10 and earn10 > 10000:
        uni["median_earn_10yr_real"] = earn10
        uni["median_earn_10yr"] = int(earn10)
        uni["_earnings_source"] = "scorecard"
    elif earn6 and earn6 > 10000:
        uni["median_earn_10yr_real"] = earn6
        uni["median_earn_10yr"] = int(earn6)
        uni["_earnings_source"] = "scorecard_6yr"

    if debt and debt > 1000:
        uni["debt_avg_real"] = debt
        uni["debt_avg"] = int(debt)
    if default_rate is not None:
        try:
            # Preserve synthetic if 0 (suppressed)
            if float(default_rate) != 0:
                uni["loan_default_real"] = float(default_rate)
                uni["loan_default"] = float(default_rate)
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
        # Don't overwrite enrollment_fte if synthetic already plausible, but update real field
    if admit is not None:
        uni["admission_rate"] = float(admit)
    if avg_inc:
        uni["avg_family_income"] = int(avg_inc)
    if pell is not None:
        uni["pell_rate"] = float(pell)

    uni["scorecard_id"] = res.get("id")
    uni["scorecard_name"] = res.get("school.name")
    uni["scorecard_city"] = res.get("school.city")
    # Update control/state if Scorecard more accurate
    # ownership: 1=public, 2=private nonprofit, 3=private for-profit
    ownership = res.get("school.ownership")
    if ownership == 1:
        uni["control"] = "public"
    elif ownership in [2,3]:
        uni["control"] = "private"
    # state
    st = res.get("school.state")
    if st:
        uni["state"] = st

    print(f"  OK {uid} -> {uni['scorecard_name']} earn={earn10 or earn6} net={net_price}")
    fixed+=1
    time.sleep(0.5)

# Also fix name for connecticut2 -> UConn if needed, keep id for stability but update display name
for uni in data["universities"]:
    if uni["id"] == "connecticut2":
        uni["name"] = "UConn"
        uni["conference"] = "Big East"
        uni["peer_group"] = "Big East"

# Update metadata
data["metadata"]["last_updated"] = "2026-08-31"
data["metadata"]["version"] = "0.6"
data["metadata"]["enriched_count"] = len([u for u in data["universities"] if u.get("median_earn_10yr_real")])
data["metadata"]["failed"] = [u["id"] for u in data["universities"] if not u.get("median_earn_10yr_real")]
data["metadata"]["source"] = "College Scorecard API (DEMO_KEY) + ID-corrected mismatches v0.6 + force-directed peers + conference 150/150"

with open(path, "w") as out:
    json.dump(data, out, indent=2)

print(f"Done fixed={fixed} total_real={data['metadata']['enriched_count']} failed={data['metadata']['failed']}")
