#!/usr/bin/env python3
"""v0.42: endowment staleness audit - refresh records whose _endowment_source
predates FY2025 (33 candidates audited 2026-10-04).

Fetch: scripts/fetch_endowment_infobox_v42.py (33 auto-picks) + 4 explicit-title
refetches (usfca, lawrence, union, scstate) saved in
data/raw/endowment-wikipedia/2026-10-04/refetch_correct_pages.json.

Review verdicts (explicit allowlist only, per the v0.12 rule):
- 29/33: infobox unchanged since the old value (same figure, incl. 4 HBCUs
  still on 2019-2021 values and akron still on 2020) -> KEEP old labeled value.
- 4 updates applied:
    morehouse 0.280 -> 0.275  (infobox $275M (2024), as of 2025)
    umkc      0.20414 -> 0.254 (infobox $254M (2026), UMKC only, as of June 30, 2026)
    knox      0.1745 -> 0.1766 (infobox $176.6M (2025); replaces audited FY2024 value)
    lawrence  0.4168 -> 0.4566 (infobox $456.6M (2025) on the CORRECT page:
                               Lawrence University, Appleton WI. v0.32 had applied
                               St. Lawrence University (Canton NY)'s $416.8M to
                               this record - latent identity bug, fixed here)
Caught-and-rejected auto-pick mismatches (NOT applied):
  usfca  -> UCSF page $2.95B (record is University of San Francisco; correct
          page still $566M (2024), unchanged)
  union  -> "University and College Union" labor-union page (record is Union
          College, Schenectady NY; correct page still $563.7M (2024), unchanged)
  scstate-> University of South Carolina $1.15B (record is South Carolina State
          University, Orangeburg; correct page still $17.2M (2023), unchanged)

Scores NOT recomputed (v0.10 formula does not use endowment).
"""
import json, os

REPO = "/home/hatch/repos/university-outcomes-tracker"
INF = "Wikipedia infobox"

MAP = {
    "morehouse": (0.275,  f"{INF} (2024): $275M (as of 2025)"),
    "umkc":      (0.254,  f"{INF} (2026): $254M (UMKC only, as of June 30, 2026)"),
    "knox":      (0.1766, f"{INF} (2025): $176.6M"),
    "lawrence":  (0.4566, f"{INF} (2025): $456.6M"),
}

DATA = os.path.join(REPO, "data", "universities.json")
data = json.load(open(DATA))
byid = {u["id"]: u for u in data["universities"]}

for uid, (val, label) in MAP.items():
    u = byid[uid]
    old = u["endowment_b"]
    u["endowment_b"] = val
    u["_endowment_source"] = label
    u["endowment_per_student"] = int(round(val * 1e9 / u["enrollment_fte"]))
    print(f"{uid}: {old} -> {val} ({u['endowment_per_student']}/student)")

# provenance annotation for the identity bug fix on lawrence
byid["lawrence"]["_identity_source"] = (
    "v0.42: endowment re-matched to Lawrence University (Appleton, WI); "
    "v0.32 had applied St. Lawrence University (Canton, NY) $416.8M to this record")

data["metadata"]["version"] = "0.42"
data["metadata"]["last_updated"] = "2026-10-04"
data["metadata"]["endowment_audit_v42"] = (
    "33 pre-FY2025 endowment sources re-audited via Wikipedia infobox; "
    "4 updated (morehouse, umkc, knox, lawrence identity-corrected); "
    "29 unchanged incl. 4 HBCUs on 2019-2021 values + akron 2020; "
    "3 auto-pick mismatches rejected (usfca->UCSF, union->labor union, scstate->USC Columbia)")

with open(DATA, "w") as f:
    json.dump(data, f, indent=2)

real = sum(1 for u in data["universities"]
           if u.get("_endowment_source") != "synthetic (placeholder)")
print(f"endowment real: {real}/249")
