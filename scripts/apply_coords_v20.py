#!/usr/bin/env python3
"""v0.20: apply reviewed Wikipedia coordinates to universities.json.

Adds lat, lon (4dp), _location_source to all 200 records. Validates US bounds
and reports coverage. Scores untouched (v0.10 formula doesn't use location).
Run AFTER manual review of data/raw/location-wikipedia/2026-09-12/review.tsv.
"""
import json, os

REPO = "/home/hatch/repos/university-outcomes-tracker"
RAW = os.path.join(REPO, "data", "raw", "location-wikipedia", "2026-09-12")
DATA = os.path.join(REPO, "data", "universities.json")

# id -> (lat, lon, source) for entries fixed during review (empty if none)
CORRECTIONS = {
    # Wikipedia {{coord}} on corrected page (athletics page picked by search)
    "hawaii": (21.297, -157.817,
               "Wikipedia {{coord}} (secondary), University of Hawai\u02bbi at M\u0101noa page, fetched 2026-09-12"),
    # No {{coord}} on enwiki article at all -> Wikidata P625 (coordinate location)
    "georgiatech": (33.7758, -84.3947,
                    "Wikidata P625 (Q864855 Georgia Tech), fetched 2026-09-12"),
    "gwu": (38.9008, -77.0508,
            "Wikidata P625 (Q432637 George Washington University), fetched 2026-09-12"),
    "williamandmary": (37.2708, -76.7083,
                       "Wikidata P625 (Q875637 College of William & Mary), fetched 2026-09-12"),
    "olemiss": (34.3653, -89.535,
                "Wikidata P625 (Q1138384 University of Mississippi), fetched 2026-09-12"),
}
DEFAULT_SOURCE = "Wikipedia {{coord}} (primary first), fetched 2026-09-12"

coords = {c["id"]: c for c in json.load(open(os.path.join(RAW, "coords_extract.json")))}
data = json.load(open(DATA))
unis = data["universities"]
assert len(unis) == 200, len(unis)

missing, oob = [], []
for u in unis:
    c = coords.get(u["id"])
    if u["id"] in CORRECTIONS:
        lat, lon, src = CORRECTIONS[u["id"]]
    elif c and c["lat"] is not None:
        lat, lon = c["lat"], c["lon"]
        src = DEFAULT_SOURCE
    else:
        missing.append(u["id"])
        continue
    if not (17.0 <= lat <= 72.0 and -180.0 <= lon <= -60.0):
        oob.append((u["id"], lat, lon))
    u["lat"] = round(lat, 4)
    u["lon"] = round(lon, 4)
    u["_location_source"] = src

print("missing:", len(missing), missing)
print("out-of-bounds:", len(oob), oob)
print("coverage:", 200 - len(missing), "/200")

meta = data.get("metadata", {})
meta["version"] = "0.20"
meta["last_updated"] = "2026-09-12"
meta["location_v20"] = {
    "real": 200 - len(missing),
    "synthetic_remaining": len(missing),
    "source": "Wikipedia {{coord}} templates (primary first)",
}
data["metadata"] = meta

json.dump(data, open(DATA, "w"), indent=1)
print("wrote", DATA)
