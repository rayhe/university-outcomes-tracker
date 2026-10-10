#!/usr/bin/env python3
"""v0.48: Endowment freshness re-probe on the 13 stalest records (2019-2023 vintages).

All other 236 records are FY2024/FY2025-vintage (NACUBO 2025 NCSE, audited FY2025,
Data USA IPEDS FY2024, or verified 2026-09-24) — left untouched.

Source for 10 of 11 updates: Data USA university profiles, which publish the
IPEDS Finance FY2024 "endowment valued at $X, as of the end of the 2024 fiscal
year" figure (same federal series as the v0.16 Clark Atlanta / v0.32 Morgan State
precedent). Xavier LA uses its audited FY2025 statements (Fresher than IPEDS
FY2024, primary source).

11 updated, 2 documented no-change:
  - alabamaam: no fresher public figure (Wikipedia still $48M (2019); AAMU Trust
    990 shows $43.0M total assets, not a clean endowment metric) — kept, labeled.
  - ucriverside: current Wikipedia infobox shows undated $165.6M vs stored
    $249.87M (2023); UC scope ambiguity — kept, flagged.
"""
import json, os, copy

DATA = "data/universities.json"
RAWDIR = "data/raw/endowment-manual/2026-10-10"
os.makedirs(RAWDIR, exist_ok=True)

UPDATES = {
    # id: (endowment_b, source_label)
    "jacksonstate": (0.061,
        "Data USA (IPEDS Finance FY2024 via datausa.io): $61M Jackson State University, verified 2026-10-10"),
    "alcorn": (0.0198,
        "Data USA (IPEDS Finance FY2024 via datausa.io): $19.8M Alcorn State University, verified 2026-10-10"),
    "delawarestate": (0.037,
        "Data USA (IPEDS Finance FY2024 via datausa.io): $37M Delaware State University, verified 2026-10-10"),
    "tennesseestate": (0.115,
        "Data USA (IPEDS Finance FY2024 via datausa.io): $115M Tennessee State University, verified 2026-10-10"),
    "hampton": (0.241,
        "Data USA (IPEDS Finance FY2024 via datausa.io): $241M Hampton University, verified 2026-10-10"),
    "tuskegee": (0.164,
        "Data USA (IPEDS Finance FY2024 via datausa.io): $164M Tuskegee University, verified 2026-10-10"),
    "akron": (0.352,
        "Data USA (IPEDS Finance FY2024 via datausa.io): $352M University of Akron Main Campus, verified 2026-10-10"),
    "xavierla": (0.191657,
        "Xavier University of Louisiana audited FY2025 financial statements (FDP Clearinghouse): $191,657,130 total endowment net assets at 6/30/2025, verified 2026-10-10"),
    "uwmilwaukee": (0.26,
        "Data USA (IPEDS Finance FY2024 via datausa.io): $260M University of Wisconsin-Milwaukee, verified 2026-10-10 (conflicts with Wikipedia infobox $323M (2023); IPEDS federal series used for consistency)"),
    "providence": (0.353,
        "Data USA (IPEDS Finance FY2024 via datausa.io): $353M Providence College, verified 2026-10-10"),
    "scstate": (0.0197,
        "Data USA (IPEDS Finance FY2024 via datausa.io): $19.7M South Carolina State University, verified 2026-10-10"),
}

data = json.load(open(DATA))
recs = data["universities"]
assert len(recs) == 249, len(recs)
by_id = {r["id"]: r for r in recs}
assert len(by_id) == 249, "duplicate ids"

before_scores = {r["id"]: r.get("score") for r in recs}

for rid, (val, src) in UPDATES.items():
    r = by_id.get(rid)
    assert r is not None, f"missing record {rid}"
    old = r["endowment_b"]
    r["endowment_b"] = val
    r["_endowment_source"] = src
    fte = r.get("enrollment_fte") or 1
    r["endowment_per_student"] = round(val * 1e9 / fte)
    print(f"{rid:15s} {r['name'][:34]:34s} {old:>8} -> {val:<8}  per-student ${r['endowment_per_student']:,}")

# 0 score movers expected: endowment is not in the v0.10 score formula
moved = [rid for rid in before_scores if by_id[rid].get("score") != before_scores[rid]]
print("score movers:", moved if moved else "0")

data["metadata"]["version"] = "0.48"
data["metadata"]["last_updated"] = "2026-10-10"
data["metadata"]["endowment_freshness_v48"] = (
    "11 of the 13 stalest endowment records (2019-2023 vintages) refreshed to "
    "IPEDS FY2024 via Data USA (10) + XULA audited FY2025 (1); alabamaam and "
    "ucriverside documented no-change (see script docstring)"
)

json.dump(data, open(DATA, "w"), indent=2)
open(DATA, "a").write("\n")
print("wrote", DATA)

sources = {
    "fetched_at": "2026-10-10",
    "method": "browser_search snippets from datausa.io university profiles (IPEDS Finance FY2024 series) + XULA audited FY2025 via fdpclearinghouse.org",
    "urls": [
        "https://datausa.io/profile/university/jackson-state-university",
        "https://datausa.io/profile/university/alcorn-state-university",
        "https://datausa.io/profile/university/delaware-state-university",
        "https://datausa.io/profile/university/tennessee-state-university",
        "http://datausa.io/profile/university/hampton-university",
        "https://datausa.io/profile/university/tuskegee-university",
        "https://datausa.io/profile/university/university-of-akron-main-campus",
        "https://datausa.io/profile/university/xavier-university-of-louisiana",
        "https://datausa.io/profile/university/university-of-wisconsin-milwaukee",
        "https://datausa.io/profile/university/providence-college",
        "https://datausa.io/profile/university/south-carolina-state-university",
        "https://fdpclearinghouse.org/file/get?id=5129",
    ],
    "values": {rid: {"endowment_b": v, "source": s} for rid, (v, s) in UPDATES.items()},
    "no_change_documented": {
        "alabamaam": "No fresher public figure found (Wikipedia infobox still $48M (2019); AAMU Trust for Educational Excellence 990 shows $43.0M total assets, not a clean endowment metric). Kept $48M (2019), labeled.",
        "ucriverside": "Current Wikipedia infobox shows undated $165.6M vs stored $249.87M (2023, as of June 30 2023); UC pooled-endowment scope ambiguity. Kept $249.87M (2023), flagged.",
    },
    "identity_notes": [
        "Providence College matched against Providence Christian College ($25.3k) and University of Providence ($20.4M) — distinct schools excluded.",
        "Xavier University of Louisiana ($183M IPEDS FY2024) distinguished from Xavier University Ohio ($269M); audited FY2025 $191.66M used as fresher primary source.",
        "Delaware State University distinguished from University of Delaware.",
    ],
}
json.dump(sources, open(os.path.join(RAWDIR, "sources.json"), "w"), indent=1)
print("wrote", os.path.join(RAWDIR, "sources.json"))
