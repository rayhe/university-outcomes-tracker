#!/usr/bin/env python3
"""v0.19: endowment gap fill round 3 - Wikipedia infobox per-school fetch.

For the 59 remaining `synthetic (placeholder)` endowment records, resolves
each school's Wikipedia page via the MediaWiki search API, fetches wikitext,
and extracts the |endowment= infobox value. Writes a review TSV; nothing is
applied here - the apply step is separate after manual review.
"""
import json, re, time, urllib.parse, urllib.request, os

REPO = "/home/hatch/repos/university-outcomes-tracker"
RAW = os.path.join(REPO, "data", "raw", "endowment-wikipedia", "2026-09-11")
os.makedirs(RAW, exist_ok=True)

WIKI = "https://en.wikipedia.org/w/api.php"

def api(params):
    q = urllib.parse.urlencode(params)
    req = urllib.request.Request(WIKI + "?" + q, headers={"User-Agent": "university-outcomes-tracker/0.19 (research bot)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())

d = json.load(open(os.path.join(REPO, "data", "universities.json")))
recs = [r for r in d["universities"] if r.get("_endowment_source") == "synthetic (placeholder)"]
print("synthetic count:", len(recs))

out = []
for r in recs:
    q = r.get("scorecard_name") or r["name"]
    try:
        sr = api({"action": "query", "list": "search", "srsearch": q + " university",
                  "format": "json", "srlimit": 3})
        results = sr.get("query", {}).get("search", [])
        title = results[0]["title"] if results else None
    except Exception as e:
        title = None
        print(r["id"], "SEARCH FAIL", e)
    endow_raw = None
    wt = None
    if title:
        try:
            pg = api({"action": "parse", "page": title, "prop": "wikitext", "format": "json"})
            wt = pg.get("parse", {}).get("wikitext", {}).get("*")
        except Exception as e:
            print(r["id"], "PAGE FAIL", e)
    if wt:
        m = re.search(r'\|\s*endowment\s*=\s*([^\n|]+)', wt)
        if m:
            endow_raw = m.group(1).strip()
            endow_raw = re.sub(r'<ref.*?(?:/>|</ref>)', '', endow_raw)
            endow_raw = re.sub(r'\{\{[^}]*\}\}', '', endow_raw)
            endow_raw = re.sub(r'\[\[([^|\]]*\|)?([^\]]*)\]\]', r'\2', endow_raw)
            endow_raw = endow_raw.strip()
    out.append({"id": r["id"], "name": r["name"], "wiki_title": title,
                "endowment_raw": endow_raw, "old_placeholder_b": r["endowment_b"]})
    time.sleep(0.6)

json.dump(out, open(os.path.join(RAW, "infobox_extract.json"), "w"), indent=1)
with open(os.path.join(RAW, "review.tsv"), "w") as f:
    f.write("id\tname\twiki_title\tendowment_raw\told_placeholder_b\n")
    for o in out:
        f.write(f"{o['id']}\t{o['name']}\t{o['wiki_title'] or ''}\t{(o['endowment_raw'] or '')[:120]}\t{o['old_placeholder_b']}\n")
print("wrote", RAW)
