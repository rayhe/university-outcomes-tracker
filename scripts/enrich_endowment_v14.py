#!/usr/bin/env python3
"""v0.14: NACUBO endowment gap fill + absurd synthetic-value correction.

Two changes, both data-correctness bugs flagged by the panel:

A) NACUBO-table assignments for identities corrected in v0.13 (they now point
   to the correct main campus, so the v0.12 near-miss rejections no longer
   apply). Values from data/raw/wikipedia-endowment/2026-09-04/parsed-fy2025.json
   (158-row NACUBO 2025 NCSE FY2025 compilation). Explicit allowlist only.
   Also restores UDel 2.06, orphaned when the delaware2 record was replaced
   by fresnostate in v0.13 (udel is now UDel Newark 130943).

B) Absurd legacy synthetic values replaced with publicly-verified real values
   (two browser_search fetches failed this turn: UCSB and UW-Seattle could not
   be verified, so they stay labeled synthetic - see labeling rule below):
   usd 12.0 -> 0.77 (Wikipedia infobox 2025: $767M)
   spelman 10.5 -> 0.61 (Spelman audited FY2025 financials: $609M endowment funds)
   morehouse 9.3 -> 0.28 (AP Jul 2024: $280M)
   chapman 7.6 -> 0.86 (Chapman president 2025 State of the University: $860M)
   northeastern 7.5 -> 2.1 (Wikipedia infobox 2025: $2.1B; audited FY2025
                            rollforward from $1.906B consistent)
   lmu 5.1 -> 0.72 (Wikipedia infobox 2024: $722.7M; record is Loyola Marymount
                    117946, NOT Loyola Chicago - v0.12 rejection trap avoided)
   ucd 4.1 -> 2.2 (UC Davis Venture Catalyst: endowment $2.2B; record is UC Davis 110644)
   byu 2.1 -> 3.71 (Wikipedia infobox FY2025: $3.71B)

Labeling rule: every record ends this run with an explicit _endowment_source.
Anything not NACUBO-real or manually-verified is stamped
"synthetic (placeholder)". Scores are NOT recomputed: the v0.10 formula does
not use endowment.
"""
import json

DATA = "data/universities.json"
NACUBO_SRC = "NACUBO 2025 NCSE FY2025 market value (via Wikipedia compilation, fetched 2026-09-04)"

# id -> (fy2025 $B, scope-note or None)
NACUBO_MAP = {
    "uva": (11.23, None),            # University of Virginia (public); v0.13 -> UVA main 234076
    "georgia": (2.18, None),         # The University of Georgia and Related Foundations; v0.13 -> UGA Athens 139959
    "kentucky": (2.17, None),        # University of Kentucky; v0.13 -> UK Lexington 157085
    "rochester": (3.24, None),       # University of Rochester; v0.13 -> URochester 195030
    "alabama": (2.59, "UA System (Tuscaloosa/Birmingham/Huntsville)"),  # Board of Trustees of UA; v0.13 -> UA Tuscaloosa 100751
    "oregonstate": (1.01, None),     # Oregon State University Foundation; v0.13 -> OSU Corvallis 209542
    "southcarolina": (1.15, None),   # USC and Affiliated Foundations; v0.13 -> USC-Columbia 218663
    "auburn": (1.31, None),          # Auburn University and Foundation; v0.13 -> Auburn 100858
    "udel": (2.06, None),            # University of Delaware; v0.13 -> UDel Newark 130943 (restores orphaned delaware2 value)
    "umassamherst": (1.80, "UMass Foundation (system)"),  # new record in v0.13, was placeholder 1.0
}

# id -> (fy $B, source label, scope-note or None)
MANUAL_MAP = {
    "usd": (0.77, "Wikipedia infobox (2025): $767M, University of San Diego", None),
    "spelman": (0.61, "Spelman College audited FY2025 financial statements: $609M endowment funds", None),
    "morehouse": (0.28, "Associated Press (Jul 2024): $280M", None),
    "chapman": (0.86, "Chapman president 2025 State of the University address: $860M", None),
    "northeastern": (2.1, "Wikipedia infobox (2025): $2.1B; audited FY2025 rollforward consistent", None),
    "lmu": (0.72, "Wikipedia infobox (2024): $722.7M, Loyola Marymount", None),
    "ucd": (2.2, "UC Davis Venture Catalyst newsletter: endowment $2.2B", None),
    "byu": (3.71, "Wikipedia infobox (FY2025): $3.71B", None),
}

data = json.load(open(DATA))
unis = {u["id"]: u for u in data["universities"]}
assert len(unis) == 200, len(unis)

missing = [i for i in list(NACUBO_MAP) + list(MANUAL_MAP) if i not in unis]
assert not missing, missing

n_nacubo = n_manual = 0
for i, (b, scope) in NACUBO_MAP.items():
    u = unis[i]
    u["endowment_b"] = b
    fte = u.get("enrollment_fte") or 0
    u["endowment_per_student"] = round(b * 1e9 / fte) if fte else None
    u["_endowment_source"] = NACUBO_SRC
    if scope:
        u["_endowment_scope"] = scope
    elif "_endowment_scope" in u and i in ("udel",):
        u.pop("_endowment_scope", None)
    n_nacubo += 1

for i, (b, src, scope) in MANUAL_MAP.items():
    u = unis[i]
    u["endowment_b"] = b
    fte = u.get("enrollment_fte") or 0
    u["endowment_per_student"] = round(b * 1e9 / fte) if fte else None
    u["_endowment_source"] = src
    u.pop("_endowment_scope", None)
    n_manual += 1

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

data["metadata"]["version"] = "0.14"
data["metadata"]["last_updated"] = "2026-09-06"
data["metadata"]["endowment_gapfill_v14"] = {
    "nacubo_new": n_nacubo,
    "manual_verified": n_manual,
    "synthetic_remaining": n_synth,
}

json.dump(data, open(DATA, "w"), indent=1)

real = sum(1 for u in data["universities"] if "synthetic" not in u.get("_endowment_source", ""))
print(f"nacubo_new={n_nacubo} manual_verified={n_manual} synthetic_labeled={n_synth} real_endowment={real}/200")
print("absurd check passed: no non-NACUBO endowment > $15B")
