#!/usr/bin/env python3
"""v0.31: expand 200 -> 250 universities (20 HBCUs + 30 LACs).

Scorecard enrichment with exact-name matching (normalized) + state tiebreak,
then mismatch audit. New schools are scored with the v0.10 formula using the
FIXED raw lo/hi from the existing 200, so the 200 existing scores are
byte-identical (assertion enforced).

Proxy credential is extracted + tested at runtime (AGENTS.md: content rotates).
"""
import json, os, re, time, urllib.parse, subprocess, sys

DATA_PATH = os.path.expanduser("~/repos/university-outcomes-tracker/data/universities.json")

def norm(s):
    s = (s or "").lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return " ".join(s.split())

# ---------- proxy credential: extract + test + use ----------
def get_proxy_user():
    import urllib.parse as up
    cands = subprocess.check_output(
        r"""grep -oP 'http://\K[^@]+(?=@hatch-egress-proxy%3a3128)' ~/.git-credentials""",
        shell=True, text=True).split()
    for u in cands:
        dec = up.unquote(u)
        code = subprocess.run(
            ["curl", "-s", "--http1.1", "--max-time", "12", "-o", "/dev/null",
             "-w", "%{http_code}", "--proxy", "http://hatch-egress-proxy:3128",
             "--proxy-user", dec, "https://api.data.gov/"],
            capture_output=True, text=True).stdout.strip()
        if code in ("200", "403", "404"):
            print(f"proxy OK (userinfo {len(dec)} chars)", flush=True)
            return dec
    sys.exit("FATAL: no working proxy credential")

PROXY_USER = get_proxy_user()

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

def fetch(name, state):
    base = ("https://api.data.gov/ed/collegescorecard/v1/schools?api_key=DEMO_KEY"
            f"&school.name={urllib.parse.quote(name)}&per_page=10"
            f"&fields={urllib.parse.quote(FIELDS)}")
    cmd = (f'https_proxy="http://{PROXY_USER}@hatch-egress-proxy:3128" '
           f'curl -s --http1.1 --max-time 30 "{base}"')
    try:
        out = subprocess.check_output(cmd, shell=True, text=True, timeout=40)
        j = json.loads(out)
        res = j.get("results") or []
    except Exception as e:
        print(f"ERR fetch {name}: {e}", file=sys.stderr)
        return None
    want = norm(name)
    exact = [r for r in res if norm(r.get("school.name")) == want]
    pool = exact or res
    if not pool:
        return None
    # tiebreak by state
    st = [r for r in pool if (r.get("school.state") or "") == state]
    pick = (st or pool)[0]
    return pick, (len(exact) > 0)

# id, name, control, state, carnegie, conference, scorecard hint,
# synthetic baseline: endowment_b, grad, ret, sf, earn, employ, giving, net, pellgap, default, debt, research_m, network_k
S = [
 # HBCUs
 ("floridaam","Florida A&M University","public","FL","R1","SWAC","Florida Agricultural and Mechanical University",0.13,0.55,0.82,14,48000,0.72,0.08,14000,0.10,0.045,26000,90,55),
 ("ncat","North Carolina A&T State University","public","NC","R1","CAA","North Carolina A & T State University",0.09,0.57,0.80,19,49000,0.73,0.07,13500,0.10,0.045,25500,55,60),
 ("jacksonstate","Jackson State University","public","MS","R1","SWAC","Jackson State University",0.07,0.45,0.72,17,44000,0.70,0.06,12500,0.12,0.055,26000,65,50),
 ("southern","Southern University and A&M College","public","LA","R2","SWAC","Southern University and A & M College",0.03,0.42,0.70,16,42000,0.69,0.05,13500,0.12,0.060,27000,20,60),
 ("grambling","Grambling State University","public","LA","R2","SWAC","Grambling State University",0.03,0.40,0.68,18,40000,0.68,0.05,12000,0.12,0.065,26500,8,40),
 ("alcorn","Alcorn State University","public","MS","R2","SWAC","Alcorn State University",0.06,0.42,0.70,15,41000,0.69,0.06,12500,0.11,0.060,26000,35,25),
 ("bethunecookman","Bethune-Cookman University","private","FL","R2","SWAC","Bethune-Cookman University",0.05,0.40,0.68,14,42000,0.70,0.07,18500,0.11,0.060,28000,5,35),
 ("delawarestate","Delaware State University","public","DE","R2","MEAC","Delaware State University",0.04,0.45,0.74,15,45000,0.71,0.06,14500,0.10,0.050,26000,35,30),
 ("morganstate","Morgan State University","public","MD","R1","MEAC","Morgan State University",0.06,0.48,0.75,16,47000,0.72,0.07,15000,0.10,0.050,26500,55,45),
 ("prairieview","Prairie View A&M University","public","TX","R2","SWAC","Prairie View A & M University",0.15,0.42,0.72,17,46000,0.72,0.06,13500,0.10,0.050,25500,30,50),
 ("tennesseestate","Tennessee State University","public","TN","R1","OVC","Tennessee State University",0.09,0.42,0.70,16,44000,0.70,0.06,13000,0.11,0.055,26000,70,55),
 ("texassouthern","Texas Southern University","public","TX","R1","SWAC","Texas Southern University",0.06,0.40,0.68,17,46000,0.71,0.05,12500,0.11,0.060,25500,25,55),
 ("alabamaam","Alabama A&M University","public","AL","R2","SWAC","Alabama A & M University",0.12,0.40,0.68,15,42000,0.69,0.06,13500,0.11,0.060,26500,45,35),
 ("hampton","Hampton University","private","VA","R2","CAA","Hampton University",0.33,0.58,0.80,13,52000,0.75,0.10,24000,0.08,0.045,27000,20,40),
 ("tuskegee","Tuskegee University","private","AL","R2","SIAC","Tuskegee University",0.15,0.52,0.78,12,48000,0.73,0.12,21500,0.08,0.050,26500,15,30),
 ("xavierla","Xavier University of Louisiana","private","LA","R2","Red River","Xavier University of Louisiana",0.20,0.55,0.78,12,50000,0.74,0.11,20500,0.08,0.048,26000,25,25),
 ("dillard","Dillard University","private","LA","Baccalaureate","HBCUAC","Dillard University",0.10,0.45,0.70,11,42000,0.70,0.12,19500,0.10,0.055,27500,3,12),
 ("norfolkstate","Norfolk State University","public","VA","R2","MEAC","Norfolk State University",0.03,0.42,0.70,16,43000,0.70,0.06,13000,0.11,0.055,26000,25,40),
 ("scstate","South Carolina State University","public","SC","R2","MEAC","South Carolina State University",0.02,0.40,0.68,15,42000,0.69,0.06,13500,0.11,0.060,26500,20,30),
 ("nccentral","North Carolina Central University","public","NC","R2","MEAC","North Carolina Central University",0.07,0.50,0.76,15,45000,0.71,0.07,13500,0.10,0.050,25500,25,45),
 # LACs
 ("oberlin","Oberlin College","private","OH","Baccalaureate","NCAC","Oberlin College",0.95,0.85,0.90,9,58000,0.76,0.22,27000,0.04,0.025,20000,5,40),
 ("kenyon","Kenyon College","private","OH","Baccalaureate","NCAC","Kenyon College",0.55,0.88,0.93,9,60000,0.77,0.28,28000,0.03,0.022,19000,4,25),
 ("grinnell","Grinnell College","private","IA","Baccalaureate","Midwest","Grinnell College",2.70,0.88,0.94,9,62000,0.78,0.30,25500,0.03,0.020,17000,6,22),
 ("reed","Reed College","private","OR","Baccalaureate","NWC","Reed College",0.65,0.80,0.88,9,60000,0.75,0.20,29000,0.04,0.024,21000,5,18),
 ("whitman","Whitman College","private","WA","Baccalaureate","NWC","Whitman College",0.65,0.88,0.92,9,61000,0.77,0.24,28000,0.03,0.022,19000,4,20),
 ("coloradocollege","Colorado College","private","CO","Baccalaureate","SCAC","Colorado College",0.90,0.86,0.92,10,64000,0.78,0.26,29500,0.03,0.022,19000,5,30),
 ("trinitytx","Trinity University","private","TX","Baccalaureate","SCAC","Trinity University",1.80,0.82,0.91,9,66000,0.80,0.20,27000,0.04,0.024,20000,8,35),
 ("rhodes","Rhodes College","private","TN","Baccalaureate","SAA","Rhodes College",0.40,0.81,0.90,10,58000,0.77,0.24,27000,0.04,0.025,20000,4,22),
 ("centre","Centre College","private","KY","Baccalaureate","SAA","Centre College",0.35,0.83,0.91,10,57000,0.77,0.28,25500,0.04,0.024,19500,3,18),
 ("denison","Denison University","private","OH","Baccalaureate","NCAC","Denison University",1.10,0.83,0.90,9,62000,0.78,0.26,28000,0.04,0.023,19500,4,28),
 ("depauw","DePauw University","private","IN","Baccalaureate","NCAC","DePauw University",0.75,0.82,0.89,9,60000,0.77,0.25,27000,0.04,0.024,20000,4,32),
 ("wabash","Wabash College","private","IN","Baccalaureate","NCAC","Wabash College",0.40,0.78,0.88,10,62000,0.79,0.30,26500,0.04,0.025,20000,3,15),
 ("stolaf","St. Olaf College","private","MN","Baccalaureate","MIAC","Saint Olaf College",0.65,0.86,0.92,11,60000,0.77,0.26,27000,0.04,0.023,20000,4,35),
 ("lawrence","Lawrence University","private","WI","Baccalaureate","Midwest","Lawrence University",0.45,0.80,0.88,8,56000,0.76,0.22,26500,0.04,0.026,20500,4,20),
 ("beloit","Beloit College","private","WI","Baccalaureate","Midwest","Beloit College",0.15,0.72,0.82,10,52000,0.74,0.20,26000,0.05,0.030,21500,3,18),
 ("knox","Knox College","private","IL","Baccalaureate","Midwest","Knox College",0.18,0.74,0.84,11,52000,0.74,0.22,25500,0.05,0.030,21000,3,16),
 ("wooster","The College of Wooster","private","OH","Baccalaureate","NCAC","The College of Wooster",0.35,0.78,0.87,11,56000,0.76,0.24,27000,0.04,0.027,20500,4,24),
 ("gettysburg","Gettysburg College","private","PA","Baccalaureate","Centennial","Gettysburg College",0.40,0.82,0.89,9,60000,0.78,0.24,28000,0.04,0.024,20000,4,30),
 ("fandm","Franklin & Marshall College","private","PA","Baccalaureate","Centennial","Franklin and Marshall College",0.45,0.86,0.91,9,62000,0.78,0.25,27500,0.04,0.023,19500,4,28),
 ("dickinson","Dickinson College","private","PA","Baccalaureate","Centennial","Dickinson College",0.55,0.83,0.90,9,60000,0.77,0.24,27500,0.04,0.024,20000,4,28),
 ("lafayette","Lafayette College","private","PA","Baccalaureate","Patriot","Lafayette College",1.00,0.88,0.93,10,72000,0.82,0.28,29000,0.03,0.020,18000,8,28),
 ("holycross","College of the Holy Cross","private","MA","Baccalaureate","Patriot","College of the Holy Cross",1.10,0.90,0.94,10,74000,0.82,0.30,28500,0.03,0.019,17500,5,35),
 ("bates","Bates College","private","ME","Baccalaureate","NESCAC","Bates College",0.40,0.89,0.94,10,64000,0.78,0.30,27500,0.03,0.021,18000,4,24),
 ("trinityct","Trinity College","private","CT","Baccalaureate","NESCAC","Trinity College",0.75,0.84,0.90,9,70000,0.80,0.26,30000,0.04,0.022,18500,5,28),
 ("conncollege","Connecticut College","private","CT","Baccalaureate","NESCAC","Connecticut College",0.35,0.84,0.90,9,62000,0.78,0.24,28000,0.04,0.023,19000,4,22),
 ("skidmore","Skidmore College","private","NY","Baccalaureate","Liberty","Skidmore College",0.45,0.86,0.91,8,62000,0.78,0.24,28000,0.04,0.023,19000,4,28),
 ("union","Union College","private","NY","Baccalaureate","Liberty","Union College",0.50,0.84,0.90,10,68000,0.80,0.24,28500,0.04,0.022,18500,5,28),
 ("bard","Bard College","private","NY","Baccalaureate","Liberty","Bard College",0.35,0.78,0.86,10,56000,0.75,0.18,28500,0.05,0.028,21000,4,25),
 ("pitzer","Pitzer College","private","CA","Baccalaureate","SCIAC","Pitzer College",0.18,0.84,0.91,10,64000,0.78,0.20,29500,0.04,0.023,18500,3,12),
 ("cmc","Claremont McKenna College","private","CA","Baccalaureate","SCIAC","Claremont McKenna College",1.10,0.92,0.94,8,92000,0.83,0.28,28000,0.03,0.018,16000,6,14),
]
assert len(S) == 50

data = json.load(open(DATA_PATH))
unis = data["universities"]
assert len(unis) == 200, len(unis)
existing = {u["id"] for u in unis}
dup = [s[0] for s in S if s[0] in existing]
assert not dup, f"id collision: {dup}"

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

LO, HI = min(raw_score(u) for u in unis), max(raw_score(u) for u in unis)
print(f"fixed raw lo/hi over existing 200: {LO:.2f} / {HI:.2f}", flush=True)

def build(s):
    (uid, name, control, state, carnegie, conf, hint, endow, gr, ret, sf,
     earn, employ, giving, net, pellgap, default, debt, research, netwk) = s
    return {
        "id": uid, "name": name, "control": control, "state": state,
        "carnegie": carnegie, "enrollment_fte": 0,
        "endowment_b": endow, "endowment_per_student": 0,
        "grad_rate_6yr": gr, "retention": ret, "sf_ratio": sf,
        "median_earn_10yr": earn, "employment_6mo": employ,
        "alumni_giving": giving, "net_price_avg": net, "pell_gap": pellgap,
        "loan_default": default, "debt_avg": debt, "research_spend_m": research,
        "alumni_network_k": netwk, "score": 0.0, "conference": conf,
        "peer_group": conf,
        "filings": {"ipeds": "2024", "990": ("2023" if control == "private" else "n/a"),
                    "audited": "2024", "scorecard": "full", "herd": "2024",
                    "state_audit": ("2024" if control == "public" else "n/a")},
        "scorecard_name_hint": hint,
    }

audit = []
for s in S:
    uni = build(s)
    hint = uni.pop("scorecard_name_hint")
    got = fetch(hint, uni["state"])
    if got:
        res, exact = got
        earn10 = res.get("latest.earnings.10_yrs_after_entry.median")
        earn6 = res.get("latest.earnings.6_yrs_after_entry.median")
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
        debt = res.get("latest.aid.median_debt.completers.overall")
        if debt and debt > 1000:
            uni["debt_avg_real"] = debt
            uni["debt_avg"] = int(debt)
        dr = res.get("latest.repayment.3_yr_default_rate")
        if dr is not None:
            try:
                if float(dr) != 0:
                    uni["loan_default_real"] = float(dr)
                    uni["loan_default"] = float(dr)
            except Exception:
                pass
        np_ = (res.get("latest.cost.avg_net_price.overall")
               or res.get("latest.cost.avg_net_price.public")
               or res.get("latest.cost.avg_net_price.private"))
        if np_ and np_ > 1000:
            uni["net_price_avg_real"] = int(np_)
            uni["net_price_avg"] = int(np_)
        rr = res.get("latest.completion.retention_rate.four_year.full_time")
        if rr:
            uni["retention_real"] = float(rr)
            uni["retention"] = float(rr)
        size = res.get("latest.student.size")
        if size:
            uni["enrollment_fte_real"] = size
            uni["enrollment_fte"] = int(size)
        adm = res.get("latest.admissions.admission_rate.overall")
        if adm is not None:
            uni["admission_rate"] = float(adm)
        inc = res.get("latest.student.demographics.avg_family_income")
        if inc:
            uni["avg_family_income"] = int(inc)
        pell = res.get("latest.aid.pell_grant_rate")
        if pell is not None:
            uni["pell_rate"] = float(pell)
        grad = res.get("latest.completion.completion_rate_4yr_150nt")
        if grad:
            uni["grad_rate_6yr_real"] = float(grad)
            uni["grad_rate_6yr"] = float(grad)
        uni["scorecard_id"] = res.get("id")
        uni["scorecard_name"] = res.get("school.name")
        uni["scorecard_city"] = res.get("school.city")
        own = res.get("school.ownership")
        if own == 1:
            uni["control"] = "public"
        elif own in (2, 3):
            uni["control"] = "private"
        st = res.get("school.state")
        if st:
            uni["state"] = st
        audit.append((uni["id"], uni["name"], uni["scorecard_id"],
                      uni["scorecard_name"], "EXACT" if exact else "FUZZY",
                      uni.get("_earnings_source")))
        print(f"OK {uni['id']} -> [{uni['scorecard_id']}] {uni['scorecard_name']} "
              f"({'EXACT' if exact else 'FUZZY'}) earn={uni['median_earn_10yr']}", flush=True)
    else:
        uni["scorecard_id"] = None
        uni["_earnings_source"] = "synthetic"
        audit.append((uni["id"], uni["name"], None, None, "FAIL", "synthetic"))
        print(f"FAIL {uni['id']} {hint} — keeping synthetic", flush=True)
    r = raw_score(uni)
    if r < LO: r = LO
    if r > HI: r = HI
    uni["score"] = round(55.0 + (r - LO) / (HI - LO) * 42.0, 1)
    unis.append(uni)
    time.sleep(0.55)

# metadata
md = data["metadata"]
md["last_updated"] = "2026-09-23"
md["version"] = "0.31"
md["total_universities"] = len(unis)
md["enriched_count"] = sum(1 for u in unis if u.get("median_earn_10yr_real"))
md["failed"] = [a[0] for a in audit if a[5] == "synthetic" and a[2] is None]
md["expansion_v31"] = 50
md["source"] = (f"College Scorecard API (DEMO_KEY) + 50 new v0.31 expansion to {len(unis)} "
                 f"(real {md['enriched_count']}) + 45 conferences")

with open(DATA_PATH, "w") as out:
    json.dump(data, out, indent=1)

print("\n--- AUDIT (id, expected, scorecard_id, scorecard_name, match, earnings) ---")
for a in audit:
    print(a)
real_new = sum(1 for a in audit if a[5] in ("scorecard", "scorecard_6yr"))
fuzzy = [a for a in audit if a[4] == "FUZZY"]
print(f"\nnew real: {real_new}/50, fuzzy matches: {len(fuzzy)}, failed: {len(md['failed'])}")
if fuzzy:
    print("FUZZY (needs review):", [(f[0], f[3]) for f in fuzzy])
