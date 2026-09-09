#!/usr/bin/env python3
"""v0.17: identity/display-name correctness pass.

Two bugs fixed as one coherent pass:
1. Identity mismatch: record 'oregon' (University of Oregon) was rematched to
   Scorecard id 209490 = Oregon Health & Science University (Portland). All
   Scorecard-sourced metrics (earnings 101028, enrollment 836, debt, default,
   net price) were OHSU's. Rematch to 209551 = University of Oregon, Eugene.
2. 20 malformed display names ("NYU University", "UMD University",
   "Morehouse University" for a College, "Penn University", etc.) corrected
   to brand-correct names. Scorecard formal names kept as the source of truth.

Then rescore (v0.10 min-max formula) and validate.
"""
import json, os, sys, subprocess, urllib.parse
sys.path.insert(0, os.path.dirname(__file__))
from raw_artifact import save_raw

REPO = os.path.expanduser("~/repos/university-outcomes-tracker")
DATA = os.path.join(REPO, "data/universities.json")

# ---- proxy (atomic extract+test+use, https_proxy env) ----
def proxy_env():
    enc = subprocess.check_output(
        r"grep -oP 'http://\K[^@]+(?=@hatch-egress-proxy%3a3128)' ~/.git-credentials",
        shell=True, text=True).strip().splitlines()
    for u in enc:
        udec = urllib.parse.unquote(u)
        p = f"http://{udec}@hatch-egress-proxy:3128"
        code = subprocess.run(
            ["curl", "-s", "--http1.1", "--max-time", "20", "-o", "/dev/null",
             "-w", "%{http_code}", "--proxy", "http://hatch-egress-proxy:3128",
             "--proxy-user", udec, "https://example.com"],
            text=True, capture_output=True).stdout.strip()
        if code == "200":
            return p
    raise SystemExit("no working proxy credential")

PROXY = proxy_env()
print("PROXY_OK len=", len(PROXY.split("@")[0].split("//")[1]))

# ---- fetch University of Oregon (Scorecard 209551) ----
FIELDS = ("id,school.name,school.city,school.state,school.ownership,"
          "latest.earnings.10_yrs_after_entry.median,"
          "latest.earnings.6_yrs_after_entry.median,"
          "latest.aid.median_debt.completers.overall,"
          "latest.repayment.3_yr_default_rate,"
          "latest.cost.avg_net_price.overall,latest.cost.avg_net_price.private,"
          "latest.completion.completion_rate_4yr_150nt,"
          "latest.student.size,"
          "latest.admissions.admission_rate.overall,"
          "latest.completion.retention_rate.four_year.full_time,"
          "latest.aid.federal_loan_rate,latest.aid.pell_grant_rate,"
          "latest.student.demographics.avg_family_income")
q = f"https://api.data.gov/ed/collegescorecard/v1/schools?api_key=DEMO_KEY&id=209551&fields={urllib.parse.quote(FIELDS)}"
env = dict(os.environ); env["https_proxy"] = PROXY
out = subprocess.check_output(["curl", "-s", "--http1.1", "--max-time", "40", q],
                              text=True, env=env)
resp = json.loads(out)
path = save_raw("collegescorecard", "uo_209551_v17", resp,
                url="https://api.data.gov/ed/collegescorecard/v1/schools?api_key=REDACTED",
                params={"id": "209551", "fields": FIELDS},
                note="v0.17 oregon identity rematch: fresh Scorecard pull for University of Oregon (was 209490 = OHSU)")
print("raw saved:", path)
row = resp["results"][0]
assert row["id"] == 209551 and "Oregon" in row["school.name"], row
print("fetched:", row["school.name"], row["school.city"], row["school.state"])

# ---- apply rematch ----
data = json.load(open(DATA))
unis = data["universities"]
rec = next(u for u in unis if u["id"] == "oregon")
before = rec["score"]

kept = {}
def take(field_key, rec_key):
    """Pull a Scorecard field; keep status-quo when suppressed/absent."""
    v = row.get(field_key)
    if v is None:
        kept[rec_key] = rec.get(rec_key)
        return rec.get(rec_key)
    return v

loan_raw = row.get("latest.repayment.3_yr_default_rate")
if loan_raw == 0:
    # Scorecard 3-yr CDR suppressed for all schools now (CAU same, v0.16);
    # keep numeric placeholder, null out the "real" marker.
    loan_default, loan_default_real = rec["loan_default"], None
    kept_note = "3_yr_default_rate suppressed (0) - kept 0.039 placeholder"
else:
    loan_default, loan_default_real = loan_raw, loan_raw
    kept_note = None

scorecard_map = {
    "scorecard_id": row["id"],
    "scorecard_name": row["school.name"],
    "scorecard_city": row["school.city"],
    "scorecard_state": row["school.state"],
    "median_earn_10yr": take("latest.earnings.10_yrs_after_entry.median", "median_earn_10yr"),
    "median_earn_10yr_real": take("latest.earnings.10_yrs_after_entry.median", "median_earn_10yr_real"),
    "_earnings_source": "scorecard",
    "debt_avg": take("latest.aid.median_debt.completers.overall", "debt_avg"),
    "debt_avg_real": take("latest.aid.median_debt.completers.overall", "debt_avg_real"),
    "loan_default": loan_default,
    "loan_default_real": loan_default_real,
    "net_price_avg": take("latest.cost.avg_net_price.overall", "net_price_avg"),
    "net_price_avg_real": take("latest.cost.avg_net_price.overall", "net_price_avg_real"),
    "grad_rate_6yr": take("latest.completion.completion_rate_4yr_150nt", "grad_rate_6yr"),
    "retention": take("latest.completion.retention_rate.four_year.full_time", "retention"),
    "enrollment_fte": take("latest.student.size", "enrollment_fte"),
    "enrollment_fte_real": take("latest.student.size", "enrollment_fte_real"),
    "admission_rate": take("latest.admissions.admission_rate.overall", "admission_rate"),
    "pell_rate": take("latest.aid.pell_grant_rate", "pell_rate"),
    "avg_family_income": take("latest.student.demographics.avg_family_income", "avg_family_income"),
    "_identity_source": ("v0.17 rematch: Scorecard id 209551 = University of Oregon, Eugene "
                         "(was 209490 = Oregon Health & Science University, Portland); "
                         "raw artifact data/raw/collegescorecard/2026-09-09/uo_209551_v17.json"),
}
rec.update(scorecard_map)
if kept:
    print("fields kept at status quo (suppressed/absent in pull):", kept)
if kept_note:
    print("note:", kept_note)
# endowment_per_student recomputed per convention
rec["endowment_per_student"] = round(rec["endowment_b"] * 1e9 / rec["enrollment_fte"])

print("oregon rematched:")
for k in ("scorecard_id", "scorecard_name", "scorecard_city", "scorecard_state",
          "median_earn_10yr", "debt_avg", "loan_default", "net_price_avg",
          "grad_rate_6yr", "retention", "enrollment_fte", "admission_rate",
          "pell_rate", "avg_family_income", "endowment_per_student"):
    print(f"  {k}: {rec[k]}")

# ---- display name corrections (brand-correct; Scorecard formal name kept as source) ----
NAME_FIXES = {
    "penn": "University of Pennsylvania",
    "washu": "Washington University in St. Louis",
    "uwmadison": "UW-Madison",
    "umd": "University of Maryland",
    "lmu": "Loyola Marymount University",
    "ucberkeley": "UC Berkeley",
    "asu": "Arizona State University",
    "uwseattle": "University of Washington",
    "uiuc": "University of Illinois Urbana-Champaign",
    "ucd": "UC Davis",
    "casewestern": "Case Western Reserve University",
    "ucsb": "UC Santa Barbara",
    "usc": "USC",
    "smu": "SMU",
    "morehouse": "Morehouse College",
    "nyu": "New York University",
    "uncchapelhil": "UNC-Chapel Hill",
    "ucsd": "UC San Diego",
    "utaustin": "UT Austin",
    "georgiatech": "Georgia Tech",
}
fixed = 0
for rid, newname in NAME_FIXES.items():
    r = next(u for u in unis if u["id"] == rid)
    if r["name"] != newname:
        print(f"  rename {rid}: '{r['name']}' -> '{newname}' (Scorecard: {r.get('scorecard_name')})")
        r["name"] = newname
        fixed += 1
print(f"renamed {fixed} records")

# ---- rescore (v0.10 formula, unchanged) ----
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

raws = [(u, raw_score(u)) for u in unis]
lo = min(r for _, r in raws); hi = max(r for _, r in raws)
LO, HI = 55.0, 97.0
for u, r in raws:
    u["score"] = round(LO + (r - lo) / (hi - lo) * (HI - LO), 1)
rec2 = next(u for u in unis if u["id"] == "oregon")
print(f"oregon score {before} -> {rec2['score']}")
moved = sum(1 for u in unis)
print("scores:", min(u["score"] for u in unis), "->", max(u["score"] for u in unis))

# ---- validate ----
assert len(unis) == 200, len(unis)
ids = [u["scorecard_id"] for u in unis]
assert len(set(ids)) == 200, "scorecard id dupes"
rids = [u["id"] for u in unis]
assert len(set(rids)) == 200, "record id dupes"
names = [u["name"] for u in unis]
assert len(set(names)) == 200, "name dupes"
assert json.dumps(data)
data["metadata"]["version"] = "0.17"
data["metadata"]["updated"] = "2026-09-09T02:00:00-07:00"
json.dump(data, open(DATA, "w"), indent=1)
print("wrote", DATA, "version 0.17")
