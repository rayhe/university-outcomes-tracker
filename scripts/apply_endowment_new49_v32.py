#!/usr/bin/env python3
"""v0.32: apply endowment infobox values for the 49 v0.31-added schools.

Combines: infobox_extract.json (49-pass) + refetch8.json (8 mismatch refetches by
explicit title) + 3 manual values (morganstate, southern, knox).
Institutional identity manually reviewed per record (8 mismatch traps documented).
Parses '$XM'/'$XM million'/'$XB billion' + &nbsp; variants.
"""
import json, re, os

REPO = "/home/hatch/repos/university-outcomes-tracker"
RAW = os.path.join(REPO, "data", "raw", "endowment-wikipedia", "2026-09-24")

def to_b(raw):
    if not raw:
        return None
    s = raw.replace("&nbsp;", " ")
    m = re.search(r"\$?\s*([\d,]+\.?\d*)\s*(billion|million|trillion|M\b)", s, re.I)
    if not m:
        return None
    v = float(m.group(1).replace(",", ""))
    u = m.group(2).lower()
    return v if u in ("billion",) else v / 1000

def src_label(o):
    t = o["wiki_title"]
    raw = o["endowment_raw"]
    m = re.search(r"\((20\d\d|FY ?20\d\d|202\d)\)", raw)
    date = f" ({m.group(1)})" if m else ""
    return f"Wikipedia infobox{date}: {raw.split('<')[0].strip()[:60]}, {t}, fetched 2026-09-24"

main = json.load(open(os.path.join(RAW, "infobox_extract.json")))
ref = {o["id"]: o for o in json.load(open(os.path.join(RAW, "refetch8.json")))}
MANUAL = {
    # id: (endowment_b, source label)
    "morganstate": (0.106, "Data USA (IPEDS Finance FY2024 via datausa.io): $106M Morgan State University, verified 2026-09-24"),
    "southern": (0.01002, "CollegeDB.app (IPEDS-derived, undated): $10,021,552 Southern University and A&M College Baton Rouge; Wikipedia page has no |endowment= (redirects to 'Southern University'), verified 2026-09-24"),
    "knox": (0.17451, "Knox College audited FY2024 (knox.edu auditor's report): endowment net assets end-of-year $174,514,569 at 6/30/2024; Wikipedia 'Knox College' page carries no |endowment=, verified 2026-09-24"),
}

report = []
updates = {}
for o in main:
    rid = o["id"]
    if rid in ref:
        o = {"id": rid, "wiki_title": ref[rid]["wiki_title"], "endowment_raw": ref[rid]["endowment_raw"]}
    if rid in MANUAL:
        b, label = MANUAL[rid]
        updates[rid] = (b, label)
        report.append(f"{rid:15s} MANUAL {b}  {label[:70]}")
        continue
    b = to_b(o["endowment_raw"])
    if b is None:
        raise SystemExit(f"UNPARSEABLE {rid}: {o['wiki_title']} | {o['endowment_raw']!r}")
    updates[rid] = (b, src_label(o))
    report.append(f"{rid:15s} {b:<8} {o['wiki_title'][:40]}")

d = json.load(open(os.path.join(REPO, "data", "universities.json")))
recs = {r["id"]: r for r in d["universities"]}
assert set(updates) == {r["id"] for r in recs.values() if "_endowment_source" not in r}, "record set mismatch"
for rid, (b, label) in updates.items():
    r = recs[rid]
    old = r["endowment_b"]
    r["endowment_b"] = b
    r["_endowment_source"] = label
    r["endowment_per_student"] = round(b * 1e9 / r["enrollment_fte"])
    if old != b:
        pass
d["metadata"]["version"] = "0.32"
d["metadata"]["last_updated"] = "2026-09-24"
json.dump(d, open(os.path.join(REPO, "data", "universities.json"), "w"), indent=2, ensure_ascii=True)

# write sources manifest
manifest = {rid: {"endowment_b": b, "_endowment_source": label, "wiki_title": (ref.get(rid) or {}).get("wiki_title")}
            for rid, (b, label) in updates.items()}
json.dump(manifest, open(os.path.join(RAW, "sources.json"), "w"), indent=1)
print("\n".join(report))
print(f"\napplied {len(updates)} endowment values; sources manifest at {RAW}/sources.json")
