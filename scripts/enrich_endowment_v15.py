#!/usr/bin/env python3
"""v0.15: verified endowment gap fill - 9 official-primary + NACUBO replacements.

One coherent data-quality change: replaces 9 synthetic (placeholder) endowment
values with exact figures verified against primary-source documents fetched
this run and committed under data/raw/endowment-manual/2026-09-07/.

Every value below was confirmed by grepping the committed artifact; see
data/raw/endowment-manual/2026-09-07/sources.json for URL, fetch timestamp,
reporting date, exact excerpt, and scope notes.

MANUAL_MAP id -> (fy $B, source label, scope-note or None):
  virginiatech 2.09      NACUBO 2025 NCSE FY2025 (Virginia Tech Foundation; existing
                             raw artifact data/raw/wikipedia-endowment/2026-09-04)
  utahstate    0.640     March 27, 2025 Utah Board of Higher Education memo:
                             "about $640 million in its endowment" (FY2024
                             yearend holdings). Approximate: page wording.
  macalester   0.920     Macalester official 2025 Facts & Figures: "Endowment
                             6/30/25: $920 million"
  usf          0.722838  USF Foundation audited FY2025 statements:
                             "Total Foundation endowment balance $722,838,408"
  dayton       0.919     University of Dayton official endowment page (retrieved
                             2026-09-07): "$919 million: The value of UD's
                             endowment" (page cites FY2026 support $37.2M)
  kansasstate  1.047320  KSU Foundation audited FY2025 statements: "Endowment
                             net assets - End of year ... $1,047,320,258"
  wyoming      0.857427  University of Wyoming Foundation audited FY2025
                             statements: "Total managed endowments ... were
                             $857,427,086 ... at June 30, 2025"
  uvm          0.972474  UVM Foundation FY2025 endowment overview: "UVM ENDOWMENT
                             - 6/30/2025 972,473,524"
  wpi          0.731422  WPI audited FY2025 statements: "Total endowment funds
                             ... 731,422" (thousands) at June 30, 2025

Scope notes:
  - wyoming: includes $347,598,365 custodial endowment corpus held by the
    Foundation for the University (audit note). Total managed endowments.
  - utahstate: approximate ("about $640 million").

Labeling rule (from v0.14, unchanged): every record ends this run with an
explicit _endowment_source. Anything not NACUBO-real or manually-verified is
stamped "synthetic (placeholder)". Scores are NOT recomputed: the v0.10
formula does not use endowment.
"""
import json

DATA = "data/universities.json"
NACUBO_SRC = "NACUBO 2025 NCSE FY2025 market value (via Wikipedia compilation, fetched 2026-09-04)"

# id -> (fy $B, source label, scope-note or None)
MANUAL_MAP = {
    "virginiatech": (2.09,
        "NACUBO 2025 NCSE FY2025 (Virginia Tech Foundation)",
        None),
    "utahstate": (0.640,
        "Utah Board of Higher Education memorandum (Mar 27, 2025): 'about $640 million in its endowment' (FY2024 yearend holdings)",
        "approximate - source wording"),
    "macalester": (0.920,
        "Macalester College official 2025 Facts & Figures: Endowment 6/30/25: $920 million",
        None),
    "usf": (0.722838,
        "University of South Florida Foundation audited FY2025 statements: Total Foundation endowment balance $722,838,408",
        None),
    "dayton": (0.919,
        "University of Dayton official endowment page (retrieved 2026-09-07): '$919 million: The value of UD\\u2019s endowment'",
        None),
    "kansasstate": (1.047320,
        "Kansas State University Foundation audited FY2025 statements: Endowment net assets - End of year $1,047,320,258",
        None),
    "wyoming": (0.857427,
        "University of Wyoming Foundation audited FY2025 statements: Total managed endowments $857,427,086 at June 30, 2025",
        "Total managed endowments; includes $347,598,365 custodial endowment corpus held by Foundation for the University"),
    "uvm": (0.972474,
        "University of Vermont Foundation FY2025 endowment overview: UVM ENDOWMENT - 6/30/2025 972,473,524",
        None),
    "wpi": (0.731422,
        "Worcester Polytechnic Institute audited FY2025 statements: Total endowment funds $731,422 (thousands) at June 30, 2025",
        None),
}

data = json.load(open(DATA))
unis = {u["id"]: u for u in data["universities"]}
assert len(unis) == 200, len(unis)

missing = [i for i in MANUAL_MAP if i not in unis]
assert not missing, missing

# every target must currently be a synthetic placeholder
stale = [i for i in MANUAL_MAP
         if "synthetic" not in unis[i].get("_endowment_source", "")]
assert not stale, f"would overwrite verified source: {stale}"

for i, (b, src, scope) in MANUAL_MAP.items():
    u = unis[i]
    u["endowment_b"] = b
    fte = u.get("enrollment_fte") or 0
    u["endowment_per_student"] = round(b * 1e9 / fte) if fte else None
    u["_endowment_source"] = src
    if scope:
        u["_endowment_scope"] = scope
    else:
        u.pop("_endowment_scope", None)

# labeling rule: every record carries an explicit source
n_synth = 0
for u in data["universities"]:
    if not u.get("_endowment_source"):
        u["_endowment_source"] = "synthetic (placeholder)"
        n_synth += 1

# sanity: no absurd values remain (nothing > table max without NACUBO source)
for u in data["universities"]:
    b = u.get("endowment_b", 0)
    src = u.get("_endowment_source", "")
    if b > 15 and "NACUBO" not in src:
        raise SystemExit(f"ABSURD REMAINS: {u['id']} {b} {src}")

data["metadata"]["version"] = "0.15"
data["metadata"]["last_updated"] = "2026-09-07"
data["metadata"]["endowment_gapfill_v15"] = {
    "verified_new": len(MANUAL_MAP),
    "synthetic_remaining": n_synth,
}

json.dump(data, open(DATA, "w"), indent=1)

real = sum(1 for u in data["universities"] if "synthetic" not in u.get("_endowment_source", ""))
print(f"verified_new={len(MANUAL_MAP)} synthetic_labeled={n_synth} real_endowment={real}/200")
print("absurd check passed: no non-NACUBO endowment > $15B")
