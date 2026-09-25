#!/usr/bin/env python3
"""Tag HBCU records in universities.json (v0.33).

HBCU classification rule:
  - conference in {SWAC, MEAC, SIAC} (all-HBCU conferences) -> HBCU
  - exceptions verified individually: tennesseestate (OVC), hampton (CAA)
All other 228 records carry no hbcu field; the UI predicate is `u.hbcu === true`.
Source annotation is per-record (_hbcu_source); this is a classification, not a
fetch, so no data/raw artifact is produced (see data/raw/README.md).
"""
import json

HBCU_CONF = {"SWAC", "MEAC", "SIAC"}
HBCU_EXCEPTIONS = {"tennesseestate": "Tennessee State University (OVC) - verified HBCU",
                   "hampton": "Hampton University (CAA) - verified HBCU"}

P = "data/universities.json"
d = json.load(open(P))
n = 0
for x in d["universities"]:
    conf = x.get("conference")
    if conf in HBCU_CONF:
        x["hbcu"] = True
        x["_hbcu_source"] = f"HBCU conference membership ({conf})"
        n += 1
    elif x["id"] in HBCU_EXCEPTIONS:
        x["hbcu"] = True
        x["_hbcu_source"] = HBCU_EXCEPTIONS[x["id"]]
        n += 1

d["metadata"]["version"] = "0.33"
d["metadata"]["last_updated"] = "2026-09-25"

with open(P, "w") as f:
    json.dump(d, f, indent=2, ensure_ascii=True)
    f.write("\n")
print(f"tagged {n} HBCU records (expected 21)")
