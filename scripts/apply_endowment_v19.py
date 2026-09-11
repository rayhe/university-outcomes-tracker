#!/usr/bin/env python3
"""v0.19: endowment gap fill round 3 - 59/59 synthetic placeholders replaced.

Every value was fetched this run from the school's Wikipedia infobox and
manually reviewed (scripts/fetch_endowment_infobox_v19.py + review.tsv).
6 search-result mismatches were re-fetched against the correct page:
uwseattle (was 'Campus of the University of Washington' page, no value),
washstate (was UW page $5.96B), usfca (was UCSF page $2.95B),
und (was NDSU page $528M), ohiou (was Wright State page $120M),
kentstate (was University of Kent UK page, GBP).

APPLY MAP: id -> (endowment $B, source label)
"""
import json, os

REPO = "/home/hatch/repos/university-outcomes-tracker"
RAW = os.path.join(REPO, "data", "raw", "endowment-wikipedia", "2026-09-11")
INF = "Wikipedia infobox"

# (value_$B, label)
MAP = {
    "uwseattle":     (5.96,    f"{INF} (2025): $5.96B"),
    "ucsb":          (0.6659,  f"{INF} (2024): $665.9M"),
    "coloradomines": (0.4633,  f"{INF} (2025): $463.3M"),
    "georgiastate":  (0.2565,  f"{INF} (2024): $256.5M"),
    "jamesmadison":  (0.181,   f"{INF} (2025): $181M"),
    "ucriverside":   (0.24987, f"{INF} (2023): $249.87M (as of June 30, 2023)"),
    "ucsc":          (0.35962, f"{INF} (2025): $359.62M"),
    "ucf":           (0.2667,  f"{INF} (FY2025): $266.7M (NACUBO 2025 NCSE)"),
    "uconn":         (0.6686,  f"{INF} (2025): $668.6M"),
    "houston":       (1.337,   f"{INF} (FY2025): $1.337B endowment ($1.35B Texas University Fund share excluded)"),
    "unm":           (0.887,   f"{INF} (2025): $887M"),
    "uncc":          (0.3767,  f"{INF} (2025): $376.7M"),
    "oklahoma":      (1.81,    f"{INF} (FY2024): $1.81B (as of June 30, 2024)"),
    "washstate":     (0.8003,  f"{INF} (2025): $800.3M"),
    "waynestate":    (0.636,   f"{INF} (2025): $636M"),
    "yeshiva":       (0.71415, f"{INF} (2025): $714.15M"),
    "rpi":           (1.02,    f"{INF} (2025): $1.02B"),
    "stevens":       (0.3877,  f"{INF} (2025): $387.7M"),
    "calpoly":       (0.3358,  f"{INF} (2025): $335.8M"),
    "coloradostate": (0.6675,  f"{INF} (2025): $667.5M"),
    "fresnostate":   (0.2548,  f"{INF} (FY2024): $254.8M (NACUBO; as of June 30, 2024)"),
    "fiu":           (0.3801,  f"{INF} (2025): $380.1M"),
    "harveymudd":    (0.45455, f"{INF} (2024): $454.55M (NACUBO; as of June 30, 2024)"),
    "illinoischicago":(0.5279, f"{INF} (2025): $527.9M"),
    "usfca":         (0.566,   f"{INF} (2024): $566M (as of June 30, 2024)"),
    "sdsu":          (0.4566,  f"{INF} (FY2024): $456.6M (NACUBO; as of June 30, 2024)"),
    "sjsu":          (0.2646,  f"{INF} (2025-26): $264.6M"),
    "unlv":          (0.47085, f"{INF} (2025): $470.85M"),
    "unr":           (0.6403,  f"{INF} (2025): $640.3M"),
    "maine":         (0.4422,  f"{INF} (2025): $442.2M"),
    "uri":           (0.2787,  f"{INF} (2025): $278.7M"),
    "hawaii":        (0.6321,  f"{INF} (2025): $632.1M (system-wide)"),
    "montanastate":  (0.3196,  f"{INF} (2025): $319.6M"),
    "montana":       (0.3207,  f"{INF} (2025): $320.7M"),
    "ndsu":          (0.528,   f"{INF} (2025): $528M"),
    "und":           (0.4714,  f"{INF} (2025): $471.4M"),
    "sdstate":       (0.2926,  f"{INF} (2025): $292.6M"),
    "boisestate":    (0.18425, f"{INF} (2025): $184.25M"),
    "idaho":         (0.474,   f"{INF} (2025): $474M"),
    "nmsu":          (0.4215,  f"{INF} (2025): $421.5M"),
    "unt":           (0.356,   f"{INF} (FY2025): $356M endowment ($1.18B Texas University Fund share excluded)"),
    "uta":           (0.2232,  f"{INF} (FY2024): $223.2M (UTA only, UT System Smartbook)"),
    "utdallas":      (0.8627,  f"{INF} (FY2024): $862.7M (UTD only, UT System Smartbook)"),
    "fau":           (0.2951,  f"{INF} (2024): $295.1M"),
    "memphis":       (0.413,   f"{INF} (2025): $413M"),
    "akron":         (0.2353,  f"{INF} (as of June 30, 2020): $235.3M - stale, latest available"),
    "toledo":        (0.6891,  f"{INF} (2025): $689.1M"),
    "kentstate":     (0.2185,  f"{INF} (2025): $218.5M"),
    "bgsu":          (0.2594,  f"{INF} (2025): $259.4M"),
    "ohiou":         (1.0,     f"{INF} (2026): $1.0B (April 2026)"),
    "miamioh":       (1.09,    f"{INF} (FY2025): $1.09B (NACUBO 2025 NCSE)"),
    "umkc":          (0.20414, f"{INF} (2023): $204.14M (UMKC only, as of June 30, 2023)"),
    "uwmilwaukee":   (0.323,   f"{INF} (2023): $323M"),
    "uab":           (1.0,     f"{INF}: $1B (no date given)"),
    "creighton":     (0.8666,  f"{INF} (2025): $866.6M"),
    "gonzaga":       (0.4988,  f"{INF} (2025): $498.8M"),
    "xavier":        (0.30065, f"{INF} (2025): $300.65M"),
    "butler":        (0.3192,  f"{INF} (2025): $319.2M"),
    "providence":    (0.321,   f"{INF} (2023): $321M (as of August 31, 2023)"),
}
assert len(MAP) == 59, len(MAP)

DATA = os.path.join(REPO, "data", "universities.json")
data = json.load(open(DATA))
byid = {u["id"]: u for u in data["universities"]}

applied, sources = [], []
for uid, (val, label) in MAP.items():
    u = byid.get(uid)
    assert u is not None, uid
    assert u.get("_endowment_source") == "synthetic (placeholder)", (uid, u.get("_endowment_source"))
    old = u["endowment_b"]
    u["endowment_b"] = val
    u["_endowment_source"] = label
    u["endowment_per_student"] = round(val * 1e9 / u["enrollment_fte"], 0)
    applied.append((uid, old, val))
    sources.append({"id": uid, "name": u["name"], "endowment_b": val,
                    "source": label, "wiki_page": u.get("scorecard_name")})

json.dump({"fetched": "2026-09-11", "method": "Wikipedia infobox per-school fetch + manual review; 6 search mismatches re-fetched on correct page",
           "records": sources},
          open(os.path.join(RAW, "sources.json"), "w"), indent=1)

data["metadata"]["version"] = "0.19"
data["metadata"]["last_updated"] = "2026-09-11"
json.dump(data, open(DATA, "w"), indent=1)

real = sum(1 for u in data["universities"] if u.get("_endowment_source") != "synthetic (placeholder)")
print(f"applied {len(applied)}; endowment real now {real}/200")
print("big corrections:", [(a, o, n) for a, o, n in applied if abs(n - o) > 0.5][:12])
