#!/usr/bin/env python3
"""v0.20: fetch campus coordinates for all 200 universities via MediaWiki API.

Resolves each school's Wikipedia page (scorecard_name search, top-3 candidates,
Jaccard token-overlap pick), then reads prop=coordinates (primary first) which
comes from the page's {{coord}} template (usually main-campus quad).

Known-trap pre-corrections from v0.19 (wrong-page fetches there):
  washstate, usfca, und, ohiou, kentstate, uwseattle -> forced correct titles.

Writes coords_extract.json + review.tsv; nothing applied here - apply step is
separate after manual review of low-confidence title picks.
"""
import json, re, time, urllib.parse, urllib.request, os, datetime

REPO = "/home/hatch/repos/university-outcomes-tracker"
RAW = os.path.join(REPO, "data", "raw", "location-wikipedia", "2026-09-12")
os.makedirs(RAW, exist_ok=True)

WIKI = "https://en.wikipedia.org/w/api.php"
UA = {"User-Agent": "university-outcomes-tracker/0.20 (research bot)"}

def api(params):
    q = urllib.parse.urlencode(params)
    req = urllib.request.Request(WIKI + "?" + q, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())

STOP = {"university", "universities", "college", "colleges", "of", "the", "and",
        "at", "a", "main", "campus", "school", "schools", "institute", "system",
        "for", "in", "de", "del", "la", "san", "saint"}

def toks(s):
    return set(t for t in re.sub(r"[^a-z0-9 ]", " ", s.lower()).split()
               if t and t not in STOP)

def jacc(a, b):
    return len(a & b) / len(a | b) if (a | b) else 0.0

FORCED = {
    "washstate": "Washington State University",
    "usfca": "University of San Francisco",
    "und": "University of North Dakota",
    "ohiou": "Ohio University",
    "kentstate": "Kent State University",
    "uwseattle": "University of Washington",
}

d = json.load(open(os.path.join(REPO, "data", "universities.json")))
recs = d["universities"]
print("records:", len(recs))

out = []
for r in recs:
    rid = r["id"]
    qname = r.get("scorecard_name") or r["name"]
    title = None
    cands = []
    note = ""
    if rid in FORCED:
        title = FORCED[rid]
        note = "forced-title (v0.19 trap)"
    else:
        try:
            sr = api({"action": "query", "list": "search", "srsearch": qname,
                      "format": "json", "srlimit": 3})
            cands = [x["title"] for x in sr.get("query", {}).get("search", [])]
        except Exception as e:
            note = f"SEARCH FAIL: {e}"
        qt = toks(qname)
        scored = sorted(((t, jacc(qt, toks(t))) for t in cands),
                        key=lambda x: -x[1])
        if scored:
            title, sc = scored[0]
            note = f"auto-pick jacc={sc:.2f}; alt=" + \
                   "|".join(f"{t}({s:.2f})" for t, s in scored[1:])
            if sc < 0.45:
                note = "REVIEW-LOW " + note
        else:
            note = "no candidates"
    lat = lon = None
    csrc = ""
    if title:
        try:
            pg = api({"action": "query", "prop": "coordinates",
                      "titles": title, "format": "json"})
            pages = pg.get("query", {}).get("pages", {})
            for pid, p in pages.items():
                cs = p.get("coordinates", [])
                prim = [c for c in cs if c.get("primary")]
                c = (prim or cs)[0] if cs else None
                if c:
                    lat, lon = c["lat"], c["lon"]
                    csrc = "primary" if (prim or cs)[0].get("primary") else "secondary"
                else:
                    note += "; NO-COORDS on page"
        except Exception as e:
            note += f"; COORD FAIL: {e}"
    out.append({"id": rid, "name": r["name"], "scorecard_name": qname,
                "state": r.get("state"), "wiki_title": title,
                "lat": lat, "lon": lon, "coord_source": csrc, "note": note})
    if len(out) % 25 == 0:
        open(os.path.join(RAW, "progress.txt"), "w").write(f"{len(out)}/200")
    time.sleep(0.5)

json.dump(out, open(os.path.join(RAW, "coords_extract.json"), "w"), indent=1)
sources = {
    "source": "Wikipedia",
    "endpoint": "https://en.wikipedia.org/w/api.php",
    "methods": ["list=search (srlimit=3, title auto-pick by Jaccard token overlap)",
                "prop=coordinates (primary first)"],
    "fetched_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "records": len(out),
    "secrets": "none involved",
}
json.dump(sources, open(os.path.join(RAW, "sources.json"), "w"), indent=1)
with open(os.path.join(RAW, "review.tsv"), "w") as f:
    f.write("id\tname\twiki_title\tlat\tlon\tcoord_source\tnote\n")
    for o in out:
        f.write(f"{o['id']}\t{o['name']}\t{o['wiki_title'] or ''}\t"
                f"{o['lat'] or ''}\t{o['lon'] or ''}\t{o['coord_source']}\t"
                f"{o['note'][:160]}\n")

nlat = sum(1 for o in out if o["lat"] is not None)
nlow = sum(1 for o in out if "REVIEW-LOW" in o["note"])
nnc = sum(1 for o in out if "NO-COORDS" in o["note"] or "FAIL" in o["note"])
print(f"coords: {nlat}/200, review-low: {nlow}, no-coords/fail: {nnc}")
print("wrote", RAW)
