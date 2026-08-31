import json, os, time, urllib.parse, subprocess, sys
log=open('/tmp/enrich.log','w')
def fetch_school(query_name):
    base = "https://api.data.gov/ed/collegescorecard/v1/schools"
    fields = ",".join([
        "id","school.name","school.city","school.state","school.ownership",
        "latest.earnings.10_yrs_after_entry.median","latest.earnings.6_yrs_after_entry.median",
        "latest.aid.median_debt.completers.overall","latest.aid.median_debt.completers.monthly_payments",
        "latest.repayment.3_yr_default_rate","latest.cost.avg_net_price.overall",
        "latest.cost.avg_net_price.public","latest.cost.avg_net_price.private",
        "latest.completion.completion_rate_4yr_150nt","latest.completion.rate_suppressed.overall",
        "latest.student.size","latest.admissions.admission_rate.overall",
        "latest.completion.retention_rate.four_year.full_time","latest.aid.federal_loan_rate",
        "latest.aid.pell_grant_rate","latest.student.demographics.avg_family_income"
    ])
    q = f"{base}?api_key=DEMO_KEY&school.name={urllib.parse.quote(query_name)}&per_page=3&fields={urllib.parse.quote(fields)}"
    cmd = f'https_proxy="http://b28e72297ea54364b447c3c06cb032db@hatch-egress-proxy:3128" curl -s --http1.1 "{q}"'
    try:
        out = subprocess.check_output(cmd, shell=True, text=True, timeout=25)
        j = json.loads(out)
        if j.get("results"):
            return j["results"][0]
    except Exception as e:
        print(f"ERR {query_name}: {e}", file=log); log.flush()
    return None

mapping = {
 "stanford": "Stanford University","mit": "Massachusetts Institute of Technology","harvard": "Harvard University",
 "caltech": "California Institute of Technology","princeton": "Princeton University","penn": "University of Pennsylvania",
 "brandeis": "Brandeis University","villanova": "Villanova University","howard": "Howard University","uf": "University of Florida",
 "pepperdine": "Pepperdine University","yale": "Yale University","ohiostate": "Ohio State University","washu": "Washington University in St Louis",
 "duke": "Duke University","carnegiemell": "Carnegie Mellon University","uwmadison": "University of Wisconsin-Madison",
 "umd": "University of Maryland-College Park","lmu": "Loyola Marymount University","tulane": "Tulane University of Louisiana",
 "santaclara": "Santa Clara University","ucberkeley": "University of California-Berkeley","emory": "Emory University",
 "asu": "Arizona State University","georgiatech": "Georgia Institute of Technology","vanderbilt": "Vanderbilt University",
 "lehigh": "Lehigh University","cornell": "Cornell University","bostonuniver": "Boston University","michigan": "University of Michigan-Ann Arbor",
 "usd": "University of San Diego","northeastern": "Northeastern University","uwseattle": "University of Washington-Seattle Campus",
 "ucla": "University of California-Los Angeles","chapman": "Chapman University","utaustin": "University of Texas at Austin",
 "uiuc": "University of Illinois Urbana-Champaign","pennstate": "Pennsylvania State University","columbia": "Columbia University",
 "ucd": "University of California-Davis","texasa&m": "Texas A & M University-College Station","northwestern": "Northwestern University",
 "johnshopkins": "Johns Hopkins University","casewestern": "Case Western Reserve University","ucsb": "University of California-Santa Barbara",
 "usc": "University of Southern California","tufts": "Tufts University","rice": "Rice University","smu": "Southern Methodist University",
 "purdue": "Purdue University","bostoncolleg": "Boston College","morehouse": "Morehouse College","rutgers": "Rutgers University",
 "notredame": "University of Notre Dame","nyu": "New York University","hbcusample": "Clark Atlanta University","georgetown": "Georgetown University",
 "uncchapelhil": "University of North Carolina at Chapel Hill","spelman": "Spelman College","ucsd": "University of California-San Diego",
}
with open(os.path.expanduser("~/repos/university-outcomes-tracker/data/universities.json")) as f:
    data=json.load(f)
enriched=0; failed=[]
for uni in data["universities"]:
    qname=mapping.get(uni["id"],uni["name"])
    print(f"Fetching {uni['id']} -> {qname} ...", file=log); log.flush()
    res=fetch_school(qname)
    if not res:
        res=fetch_school(uni["name"].replace(" University","").strip())
    if res:
        earn10=res.get("latest.earnings.10_yrs_after_entry.median")
        debt=res.get("latest.aid.median_debt.completers.overall")
        default_rate=res.get("latest.repayment.3_yr_default_rate")
        net_price=res.get("latest.cost.avg_net_price.overall") or res.get("latest.cost.avg_net_price.public") or res.get("latest.cost.avg_net_price.private")
        grad_rate=res.get("latest.completion.rate_suppressed.overall") or res.get("latest.completion.completion_rate_4yr_150nt")
        size=res.get("latest.student.size"); retention=res.get("latest.completion.retention_rate.four_year.full_time")
        admit=res.get("latest.admissions.admission_rate.overall"); avg_inc=res.get("latest.student.demographics.avg_family_income")
        pell=res.get("latest.aid.pell_grant_rate")
        if earn10 and earn10>10000:
            uni["median_earn_10yr_real"]=earn10; uni["median_earn_10yr"]=int(earn10); uni["_earnings_source"]="scorecard"
        if debt and debt>1000:
            uni["debt_avg_real"]=debt; uni["debt_avg"]=int(debt)
        if default_rate is not None:
            try: uni["loan_default_real"]=float(default_rate); uni["loan_default"]=float(default_rate)
            except: pass
        if net_price and net_price>1000:
            uni["net_price_avg_real"]=int(net_price); uni["net_price_avg"]=int(net_price)
        if retention: 
            try: uni["retention_real"]=float(retention); uni["retention"]=float(retention)
            except: pass
        if size: uni["enrollment_fte_real"]=size
        if admit is not None: uni["admission_rate"]=float(admit)
        if avg_inc: uni["avg_family_income"]=int(avg_inc)
        if pell is not None: uni["pell_rate"]=float(pell)
        uni["scorecard_id"]=res.get("id"); uni["scorecard_name"]=res.get("school.name"); uni["scorecard_city"]=res.get("school.city")
        enriched+=1
        print(f"  OK {uni['id']} earn={earn10} debt={debt} def={default_rate} net={net_price}", file=log); log.flush()
    else:
        failed.append(uni["id"]); print(f"  FAIL {uni['id']}", file=log); log.flush()
    time.sleep(0.4)

data["metadata"]["last_updated"]="2026-08-31"; data["metadata"]["version"]="0.2"; data["metadata"]["enriched_count"]=enriched; data["metadata"]["failed"]=failed
data["metadata"]["source"]="College Scorecard API (DEMO_KEY) + IPEDS + NACUBO synthetic fallback"
with open(os.path.expanduser("~/repos/university-outcomes-tracker/data/universities.json"),"w") as out:
    json.dump(data,out,indent=2)
print(f"Done enriched={enriched} failed={failed}", file=log); log.flush()
