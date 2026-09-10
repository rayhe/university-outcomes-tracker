#!/usr/bin/env python3
"""match_herd_v18.py — Match our 200 universities to NSF HERD FY2024 Table 19
(ns f26304) R&D expenditures.

Step 1 (this script): normalize names, compute Jaccard token-set best match,
apply explicit alias overrides for known collisions, and write a review TSV.
A human MUST review every row of the TSV before apply_herd_v18.py runs.

Raw artifacts: data/raw/nsf-herd/2026-09-10/
"""
import json, os, re, shutil, sys

REPO = os.path.expanduser("~/repos/university-outcomes-tracker")
GOAL_HIDDEN = os.path.expanduser("~/workspace/goals/university-outcomes-tracker/hidden_files")
RAW_DIR = os.path.join(REPO, "data", "raw", "nsf-herd", "2026-09-10")
HERD_XLSX = "/tmp/herd19.xlsx"

EXPAND = {
    "u": "university", "univ": "university",
    "c": "college", "coll": "college",
    "inst": "institute", "sch": "school",
    "tech": "technology", "polytech": "polytechnic",
    "st": "saint", "ctr": "center", "med": "medical",
    "agr": "agricultural", "mech": "mechanical",
}
STOP = {"the", "of", "at", "and", "in", "a", "an", "main", "campus", "de", "la"}

def tokens(name):
    s = name.lower()
    s = s.replace("&", " and ").replace("-", " ").replace(",", " ").replace(".", " ")
    s = s.replace("'", "").replace("(", " ").replace(")", " ")
    toks = []
    for t in s.split():
        t = EXPAND.get(t, t)
        if t in STOP:
            continue
        toks.append(t)
    # drop trailing lone footnote letter (a/b/c/d/e) from HERD superscripts
    if toks and len(toks[-1]) == 1 and toks[-1] in "abcde":
        toks = toks[:-1]
    return set(toks)

def jaccard(a, b):
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)

# our_id -> exact HERD institution name (known collisions / disambiguations)
ALIASES = {
    "miami": "U. Miami",
    "miamioh": "Miami U.",
    "usd": "U. San Diego",
    "usfca": "U. San Francisco",
    "sdsu": "San Diego State U.",
    "baylor": "Baylor U.",
    "morehouse": "Morehouse C.",
    "spelman": "Spelman C.",
    "dartmouth": "Dartmouth C. and Dartmouth Hitchcock Medical Center",
    "vanderbilt": "Vanderbilt U. and Vanderbilt U. Medical Center",
    "pennstate": "Pennsylvania State U., University Park and Hershey Medical Center",
    "denver": "U. Denver",
    "rochester": "U. Rochester",
    "stevens": "Stevens Institute of Technology",
    "williams": "Williams C.",
    "amherst": "Amherst C.",
    "pomona": "Pomona C.",
    "wesleyan": "Wesleyan U.",
    "columbia": "Columbia U. in the City of New York",
    "northeastern": "Northeastern U.",
    "umassamherst": "U. Massachusetts, Amherst",
    "purdue": "Purdue U., West Lafayette",
    "texasa&m": "Texas A&M U., College Station and Health Science Center",
    "chicago": "U. Chicago",
    "uwseattle": "U. Washington, Seattle",
    "washstate": "Washington State U.",
    "washu": "Washington U., Saint Louis",
    "gwu": "George Washington U.",
    "umd": "U. Marylandb",
    "oklahoma": "U. Oklahomac",
    "hopkins": None,  # not in our 200
    "lmu": "Loyola Marymount U.",
    "loyolachicago": "Loyola U., Chicago",
    "cornell": "Cornell U.",
    "nebraska": "U. Nebraska, Lincoln and Medical Center",
    "rutgers": "Rutgers, State U. New Jersey, New Brunswick",
    "pitt": "U. Pittsburgh, Pittsburgh",
    "indiana": "Indiana U., Bloomington",
    "colorado": "U. Colorado Boulder",
    "stonybrook": "SUNY, Stony Brook U.",
    "ualbany": "SUNY, U. Albany",
    "buffalo": "SUNY, U. Buffalo",
    "binghamton": "SUNY, Binghamton U.",
    "auburn": "Auburn U., Auburn",
    "alabama": "U. Alabama, Tuscaloosa",
    "lsu": "Louisiana State U., Baton Rouge",
    "southcarolina": "U. South Carolina, Columbia",
    "kentucky": "U. Kentucky",
    "oregon": "U. Oregon",
    "uva": "U. Virginia, Charlottesville",
    "georgia": "U. Georgia",
    "georgiastate": "Georgia State U.",
    "uconn": "U. Connecticut",
    "minnesota": "U. Minnesota, Twin Cities",
    "wisconsin": "U. Wisconsin-Madison",
    "uiuc": "U. Illinois, Urbana-Champaign",
    "arizonastate": "Arizona State U.",
    "ohiostate": "Ohio State U.",
    "florida": "U. Florida",
    "floridastate": "Florida State U.",
    "texastech": "Texas Tech U.",
    "utaustin": "U. Texas, Austin",
    "utdallas": "U. Texas, Dallas",
    "utah": "U. Utah",
    "utahstate": "Utah State U.",
    "virginiatech": "Virginia Polytechnic Institute and State U.",
    "unc": "U. North Carolina, Chapel Hill",
    "ncstate": "North Carolina State U.",
    "cincinnati": "U. Cincinnati",
    "houston": "U. Houston",
    "temple": "Temple U.",
    "louisville": "U. Louisville",
    "syracuse": "Syracuse U.",
    "tcu": "Texas Christian U.",
    "tulane": "Tulane U.",
    "smu": "Southern Methodist U.",
    "rice": "Rice U.",
    "notredame": "U. Notre Dame",
    "emory": "Emory U.",
    "duke": "Duke U.",
    "northwestern": "Northwestern U.",
    "brown": "Brown U.",
    "yale": "Yale U.",
    "harvard": "Harvard U.",
    "stanford": "Stanford U.",
    "princeton": "Princeton U.",
    "caltech": "California Institute of Technology",
    "cmu": "Carnegie Mellon U.",
    "mit": "Massachusetts Institute of Technology",
    "nyu": "New York U.",
    "usc": "U. Southern California",
    "ucla": "U. California, Los Angeles",
    "ucsd": "U. California, San Diego",
    "ucberkeley": "U. California, Berkeley",
    "ucdavis": "U. California, Davis",
    "ucirvine": "U. California, Irvine",
    "ucsb": "U. California, Santa Barbara",
    "ucsc": "U. California, Santa Cruz",
    "ucriverside": "U. California, Riverside",
    "ucmerced": "U. California, Merced",
    "brandeis": "Brandeis U.",
    "case": "Case Western Reserve U.",
    "tufts": "Tufts U.",
    "wakeforest": "Wake Forest U.",
    "lehigh": "Lehigh U.",
    "rpi": "Rensselaer Polytechnic Institute",
    "wpi": "Worcester Polytechnic Institute",
    "drexel": "Drexel U.",
    "georgetown": "Georgetown U.",
    "bostonu": "Boston U.",
    "american": "American U.",
    "fordham": "Fordham U.",
    "howard": "Howard U.",
    "clarkatlanta": "Clark Atlanta U.",
    "swarthmore": "Swarthmore C.",
    "wellesley": "Wellesley C.",
    "bowdoin": "Bowdoin C.",
    "middlebury": "Middlebury C.",
    "vassar": "Vassar C.",
    "colby": "Colby C.",
    "hamilton": "Hamilton C.",
    "macalester": "Macalester C.",
    "creighton": "Creighton U.",
    "gonzaga": None,  # not in HERD Table 19 — keep synthetic, labeled
    "marquette": "Marquette U.",
    "xavier": None,  # Xavier U. Louisiana (16.0M) is a different school; Xavier OH not in HERD — keep synthetic, labeled
    "butler": "Butler U.",
    "providence": "Providence C.",
    "villanova": "Villanova U.",
    "santaclara": "Santa Clara U.",
    "pepperdine": "Pepperdine U.",
    "chapman": "Chapman U.",
    "byu": "Brigham Young U., Provo",
    "dayton": "U. Dayton",
    "saintlouis": "Saint Louis U.",
    "depaul": "DePaul U.",
    "iit": "Illinois Institute of Technology",
    "rit": "Rochester Institute of Technology",
}

def main():
    import openpyxl
    os.makedirs(RAW_DIR, exist_ok=True)
    # persist raw xlsx artifact
    dst = os.path.join(RAW_DIR, "nsf26304-tab019.xlsx")
    if not os.path.exists(dst):
        shutil.copy(HERD_XLSX, dst)
    wb = openpyxl.load_workbook(HERD_XLSX, read_only=True)
    ws = wb.active
    herd = []
    for r in ws.iter_rows(values_only=True):
        if r[0] and isinstance(r[0], str) and r[0] not in ("Institution", "Table 19") \
           and "Higher education" not in r[0] and "(Dollars" not in r[0] \
           and r[6] is not None and r[6] != "":
            rk = int(float(r[1])) if r[1] not in (None, "-", "") else None
            herd.append({"name": r[0], "rank": rk, "rd_m": round(float(r[6]) / 1000.0, 2)})
    # Rank column in the sheet is by NON-medical R&D; compute overall rank from totals
    herd_sorted = sorted(herd, key=lambda h: h["rd_m"], reverse=True)
    for i, h in enumerate(herd_sorted, 1):
        h["overall_rank"] = i
    with open(os.path.join(RAW_DIR, "herd_table19_parsed.json"), "w") as f:
        json.dump({"_fetch_meta": {
            "source": "nsf-herd",
            "endpoint": "https://ncses.nsf.gov/pubs/nsf26304/assets/data-tables/tables/nsf26304-tab019.xlsx",
            "fetched_at": "2026-09-10",
            "note": "NSF NCSES HERD FY2024, Table 19: Higher education R&D expenditures at all institutions, ranked by all R&D expenditures, by source of funds. Dollars converted thousands->millions."},
            "institutions": herd}, f, indent=1)
    print(f"HERD institutions parsed: {len(herd)}, raw saved to {RAW_DIR}")

    d = json.load(open(os.path.join(REPO, "data", "universities.json")))
    recs = d["universities"]
    herd_tok = [(h, tokens(h["name"])) for h in herd]
    herd_by_name = {h["name"]: h for h in herd}

    rows = []
    used = set()
    for r in recs:
        our = r["scorecard_name"] or r["name"]
        ot = tokens(our)
        alias = ALIASES.get(r["id"])
        if alias is None and r["id"] in ALIASES:
            rows.append((r["id"], our, r["state"], "", "", "", "ALIAS_NONE", f"synthetic kept {r['research_spend_m']}"))
            continue
        if alias:
            h = herd_by_name.get(alias)
            if h:
                used.add(alias)
                rows.append((r["id"], our, r["state"], h["name"], h["rd_m"], h["overall_rank"], "ALIAS", ""))
            else:
                rows.append((r["id"], our, r["state"], "", "", "", "ALIAS_MISS", f"alias {alias!r} not in HERD; synthetic kept"))
            continue
        best, bs = None, 0
        for h, ht in herd_tok:
            s = jaccard(ot, ht)
            if s > bs:
                best, bs = h, s
        if best and bs >= 0.5:
            used.add(best["name"])
            rows.append((r["id"], our, r["state"], best["name"], best["rd_m"], best["overall_rank"], f"AUTO_{bs:.2f}", ""))
        else:
            rows.append((r["id"], our, r["state"], "", "", "", "NO_MATCH", f"best={best['name'] if best else None}@{bs:.2f}; synthetic kept {r['research_spend_m']}"))

    out = os.path.join(GOAL_HIDDEN, "herd_match_review_v18.tsv")
    with open(out, "w") as f:
        f.write("our_id\tour_name\tstate\therd_name\therd_rd_m\therd_rank\tmethod\tnote\n")
        for row in rows:
            f.write("\t".join(str(x) for x in row) + "\n")
    auto = sum(1 for r in rows if r[6].startswith("AUTO"))
    aliasn = sum(1 for r in rows if r[6] == "ALIAS")
    nom = sum(1 for r in rows if r[6] in ("NO_MATCH", "ALIAS_MISS", "ALIAS_NONE"))
    print(f"review TSV: {out} — AUTO {auto}, ALIAS {aliasn}, UNMATCHED {nom}, total {len(rows)}")
    # collisions: HERD names used twice
    from collections import Counter
    c = Counter(r[3] for r in rows if r[3])
    dup = [k for k, v in c.items() if v > 1]
    print("DUPLICATE HERD ASSIGNMENTS:", dup if dup else "none")

if __name__ == "__main__":
    main()
