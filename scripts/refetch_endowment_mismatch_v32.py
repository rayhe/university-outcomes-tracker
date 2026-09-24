#!/usr/bin/env python3
"""v0.32: refetch 8 mismatched/empty endowment infobox pages by explicit Wikipedia title.

Traps caught in review of infobox_extract.json (49/49 pass):
- southern -> "Southern University" (New Orleans, different school)
- delawarestate -> "University of Delaware" ($2.06B, v0.12 trap - record is Delaware State)
- scstate -> "University of South Carolina" ($1.15B - record is SC State)
- dillard -> "Annie Dillard" (the author)
- trinityct -> "Trinity College, Cambridge" (GBP - record is Trinity College, Hartford CT)
- conncollege -> "List of colleges and universities in Connecticut" (no infobox)
- union -> "University and College Union" (UK trade union - record is Union College, Schenectady)
- morganstate -> page carried no |endowment= in first pass
"""
import json, re, urllib.parse, urllib.request, os, time

REPO = "/home/hatch/repos/university-outcomes-tracker"
RAW = os.path.join(REPO, "data", "raw", "endowment-wikipedia", "2026-09-24")
WIKI = "https://en.wikipedia.org/w/api.php"

TITLES = {
    "southern": "Southern University and A&M College",
    "delawarestate": "Delaware State University",
    "scstate": "South Carolina State University",
    "dillard": "Dillard University",
    "trinityct": "Trinity College (Connecticut)",
    "conncollege": "Connecticut College",
    "union": "Union College",
    "morganstate": "Morgan State University",
}

def api(params):
    q = urllib.parse.urlencode(params)
    req = urllib.request.Request(WIKI + "?" + q, headers={"User-Agent": "university-outcomes-tracker/0.32 (research bot)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())

out = []
for rid, title in TITLES.items():
    pg = api({"action": "parse", "page": title, "prop": "wikitext", "format": "json"})
    err = pg.get("error")
    wt = None if err else pg.get("parse", {}).get("wikitext", {}).get("*")
    endow_raw = None
    if wt:
        m = re.search(r'\|\s*endowment\s*=\s*([^\n|]+)', wt)
        if m:
            endow_raw = m.group(1).strip()
            endow_raw = re.sub(r'<ref.*?(?:/>|</ref>)', '', endow_raw)
            endow_raw = re.sub(r'\{\{[^}]*\}\}', '', endow_raw)
            endow_raw = re.sub(r'\[\[([^|\]]*\|)?([^\]]*)\]\]', r'\2', endow_raw)
            endow_raw = endow_raw.strip()
    out.append({"id": rid, "wiki_title": title, "error": err.get("info") if err else None,
                "endowment_raw": endow_raw})
    print(rid, "|", title, "|", (endow_raw or "NONE/ERR")[:70])
    time.sleep(0.6)

json.dump(out, open(os.path.join(RAW, "refetch8.json"), "w"), indent=1)
print("wrote", os.path.join(RAW, "refetch8.json"))
