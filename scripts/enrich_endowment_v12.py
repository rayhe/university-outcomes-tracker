#!/usr/bin/env python3
"""v0.12: replace synthetic endowment_b with real NACUBO 2025 NCSE FY2025 market values
(compiled via Wikipedia 'List of colleges and universities in the US by endowment';
raw fetch artifacts committed under data/raw/wikipedia-endowment/2026-09-04/).

EXPLICIT allowlist only: every mapping was hand-adjudicated against the NACUBO
table on 2026-09-04. Near-miss rejections (documented in iteration log):
  floridastate->UF, georgiastate->UGA, michiganstate->UMich, pennstate->Penn,
  bostoncolleg->BU, iowastate->Iowa, asu->UArizona, ucla->UC Regents,
  mississippistate->Ole Miss, usfca->UCSF, sdsu->UCSD, udel->UDel, rochester->URoch,
  oregonstate->UOregon, txstate->UT System, lmu->Loyola Chicago, stevens->RIT,
  miamioh->UMiami, ndsu/und->NC State, sdstate->USC, nmsu/unm->UNH, uconn etc.
System/foundation figures are flagged via _endowment_scope so the UI can caveat.
Scores are NOT recomputed: the v0.10 formula does not use endowment.
"""
import json, datetime

DATA = "data/universities.json"
SRC = "NACUBO 2025 NCSE FY2025 market value (via Wikipedia compilation, fetched 2026-09-04)"

# id -> (fy2025 $B, scope-note or None). scope set when figure is system/foundation-wide.
MAP = {
 # private, campus-exact
 "stanford": (40.79, None), "mit": (27.37, None), "harvard": (55.67, None),
 "caltech": (4.32, None), "princeton": (36.42, None), "penn": (24.81, None),
 "brandeis": (1.36, None), "villanova": (1.47, None), "howard": (1.12, None),
 "pepperdine": (1.29, None), "yale": (44.15, None), "duke": (12.32, None),
 "washu": (13.30, None), "carnegiemell": (4.29, None), "tulane": (2.47, None),
 "santaclara": (1.67, None), "emory": (12.00, None), "vanderbilt": (10.86, None),
 "lehigh": (2.00, None), "cornell": (11.75, None), "bostonuniver": (4.02, None),
 "bostoncolleg": (4.24, None), "columbia": (15.92, None), "northwestern": (15.17, None),
 "johnshopkins": (13.73, None), "casewestern": (2.52, None), "usc": (9.03, None),
 "tufts": (2.71, None), "rice": (8.50, None), "smu": (2.34, None),
 "notredame": (20.09, None), "nyu": (7.28, None), "georgetown": (3.95, None),
 "brown": (7.28, None), "dartmouth": (8.96, None), "uchicago": (10.62, None),
 "baylor": (2.18, None), "drexel": (1.13, None), "fordham": (1.05, None),
 "gwu": (2.81, None), "miami": (1.71, None), "wakeforest": (2.15, None),
 "bucknell": (1.26, None), "carleton": (1.33, None), "claremont": (1.35, None),
 "colgate": (1.34, None), "davidson": (1.46, None), "denver": (1.15, None),
 "depaul": (1.15, None), "williams": (3.93, None), "amherst": (3.90, None),
 "swarthmore": (2.84, None), "pomona": (3.22, None), "wellesley": (3.19, None),
 "bowdoin": (2.92, None), "middlebury": (1.73, None), "wesleyan": (1.64, None),
 "vassar": (1.39, None), "colby": (1.25, None), "loyolachicago": (1.37, None),
 "slu": (2.02, None), "tcu": (2.85, None), "syracuse": (2.27, None),
 "marquette": (1.13, None), "hamilton": (1.50, None), "temple": (1.05, None),
 # public, campus-exact (incl. campus foundations)
 "uf": (2.69, None), "ucberkeley": (3.39, None), "ucsd": (1.79, None),
 "utaustin": (6.49, None), "ucla": (4.77, None), "georgiatech": (3.51, None),
 "uncchapelhil": (6.22, None), "clemson": (1.24, None), "louisville": (1.07, None),
 "utah": (2.07, None), "williamandmary": (1.59, None), "arizona": (1.50, None),
 "rutgers": (2.35, None), "ncstate": (2.54, None), "texastech": (3.07, None),
 "utsa": (1.21, None), "pitt": (6.15, None), "iowa": (3.77, None),
 "ohiostate": (8.62, None), "michigan": (21.20, None), "purdue": (4.44, None),
 "minnesota": (6.45, None), "cincinnati": (1.77, None), "oklahomastate": (1.56, None),
 "delaware2": (2.06, None), "floridastate": (1.11, None), "michiganstate": (4.61, None),
 "pennstate": (5.06, None), "asu": (1.76, None), "iowastate": (1.91, None),
 "arkansas": (1.81, None), "olemiss": (1.00, None), "mississippistate": (1.00, None),
 "ucirvine": (1.03, None),
 # system / foundation-wide figures attributed to flagship campus
 "uwmadison": (4.92, "UW Foundation (system)"), "umd": (2.46, "USM Foundation (system)"),
 "uiuc": (3.80, "U of I & Foundations (system)"), "colorado": (2.47, "CU Foundation (system)"),
 "nebraska": (2.72, "NU system"), "missouri": (2.55, "MU System"),
 "tennessee": (1.92, "UT System"), "unh": (1.06, "USNH system"),
 "kansas": (2.69, None), "lsu": (1.24, "LSU System"),
 "indiana": (4.05, "IU Foundation (system)"), "txstate": (2.11, "TSU System"),
}

data = json.load(open(DATA))
unis = {u["id"]: u for u in data["universities"]}
assert len(unis) == 200, len(unis)

missing = [i for i in MAP if i not in unis]
assert not missing, missing

n = 0
for i, (b, scope) in MAP.items():
    u = unis[i]
    u["endowment_b"] = b
    fte = u.get("enrollment_fte") or 0
    u["endowment_per_student"] = round(b * 1e9 / fte) if fte else None
    u["_endowment_source"] = SRC
    if scope:
        u["_endowment_scope"] = scope
    elif "_endowment_scope" in u:
        del u["_endowment_scope"]
    n += 1

synthetic = [i for i, u in unis.items() if "_endowment_source" not in u]
print(f"updated {n}/200, still synthetic: {len(synthetic)}")
print("synthetic ids:", ", ".join(sorted(synthetic)))

# sanity: largest / smallest real
real = [(u["id"], u["endowment_b"]) for u in unis.values() if "_endowment_source" in u]
real.sort(key=lambda x: -x[1])
print("top5:", real[:5]); print("bottom5:", real[-5:])

json.dump(data, open(DATA, "w"), indent=1)
print("wrote", DATA)
