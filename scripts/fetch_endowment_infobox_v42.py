#!/usr/bin/env python3
"""v0.42: endowment staleness audit - Wikipedia infobox re-fetch for records
whose _endowment_source predates FY2025 (33 records as of 2026-10-04).

Writes infobox_extract.json + review.tsv under
data/raw/endowment-wikipedia/2026-10-04/ with per-school checkpointing
(progress.txt) per the v0.20 lesson. Nothing is applied here - the apply step
is separate after manual review (explicit allowlist only, per the v0.12 rule).
"""
import json, re, time, urllib.parse, urllib.request, os

REPO = "/home/hatch/repos/university-outcomes-tracker"
RAW = os.path.join(REPO, "data", "raw", "endowment-wikipedia", "2026-10-04")
os.makedirs(RAW, exist_ok=True)
PROG = os.path.join(RAW, "progress.txt")

WIKI = "https://en.wikipedia.org/w/api.php"

def api(params):
    q = urllib.parse.urlencode(params)
    req = urllib.request.Request(WIKI + "?" + q,
        headers={"User-Agent": "university-outcomes-tracker/0.42 (research bot)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())

# ids whose _endowment_source mentions a year <= 2024 (audited 2026-10-04)
TARGETS = ["lmu","ucsb","morehouse","georgiastate","ucriverside","oklahoma",
    "fresnostate","harveymudd","usfca","sdsu","fau","akron","umkc",
    "uwmilwaukee","providence","ncat","jacksonstate","alcorn","delawarestate",
    "tennesseestate","texassouthern","alabamaam","hampton","tuskegee",
    "xavierla","scstate","nccentral","lawrence","knox","wooster","fandm",
    "union","pitzer"]

done = set()
if os.path.exists(PROG):
    done = set(x.strip() for x in open(PROG) if x.strip())

d = json.load(open(os.path.join(REPO, "data", "universities.json")))
byid = {u["id"]: u for u in d["universities"]}

out_path = os.path.join(RAW, "infobox_extract.json")
out = json.load(open(out_path)) if os.path.exists(out_path) else []
seen = {o["id"] for o in out}

for uid in TARGETS:
    if uid in done or uid in seen:
        continue
    r = byid[uid]
    q = r.get("scorecard_name") or r["name"]
    title, endow_raw, wt_note = None, None, None
    try:
        sr = api({"action": "query", "list": "search", "srsearch": q + " university",
                  "format": "json", "srlimit": 3})
        results = sr.get("query", {}).get("search", [])
        title = results[0]["title"] if results else None
    except Exception as e:
        wt_note = f"SEARCH FAIL {e}"
        print(uid, "SEARCH FAIL", e)
    if title:
        try:
            pg = api({"action": "parse", "page": title, "prop": "wikitext", "format": "json"})
            wt = pg.get("parse", {}).get("wikitext", {}).get("*")
            if wt:
                m = re.search(r'\|\s*endowment\s*=\s*([^\n|]+)', wt)
                if m:
                    endow_raw = m.group(1).strip()
                    endow_raw = re.sub(r'<ref.*?(?:/>|</ref>)', '', endow_raw)
                    endow_raw = re.sub(r'\{\{[^}]*\}\}', '', endow_raw)
                    endow_raw = re.sub(r'\[\[([^|\]]*\|)?([^\]]*)\]\]', r'\2', endow_raw)
                    endow_raw = endow_raw.strip()
        except Exception as e:
            wt_note = f"PAGE FAIL {e}"
            print(uid, "PAGE FAIL", e)
    out.append({"id": uid, "name": r["name"], "scorecard_name": r.get("scorecard_name"),
                "wiki_title": title, "endowment_raw": endow_raw,
                "old_value_b": r["endowment_b"], "old_source": r["_endowment_source"],
                "note": wt_note})
    json.dump(out, open(out_path, "w"), indent=1)
    with open(PROG, "a") as f:
        f.write(uid + "\n")
    print(uid, "->", title, "|", (endow_raw or "")[:80])
    time.sleep(0.6)

with open(os.path.join(RAW, "review.tsv"), "w") as f:
    f.write("id\tname\twiki_title\tendowment_raw\told_value_b\told_source\n")
    for o in out:
        f.write(f"{o['id']}\t{o['name']}\t{o['wiki_title'] or ''}\t{(o['endowment_raw'] or '')[:120]}\t{o['old_value_b']}\t{o['old_source'][:70]}\n")
print("wrote", RAW, "-", len(out), "records")
