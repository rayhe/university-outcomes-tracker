#!/usr/bin/env python3
"""v0.34: add per-value synthetic source labels for alumni_giving + employment_6mo.

Closes the v0.18-style trust gap: the detail panel displayed Employment 6mo and
Alumni Giving percentages with no provenance, unlike research (fixed v0.32) and
the Scorecard-real fields (realBadge). The 2026-09-26 alumni-giving feasibility
probe (see data/raw/alumni-giving-probe/2026-09-26/README.md) concluded neither
field is replaceable via a public API today:
  - IPEDS Finance collects total "private gifts" (aggregate, no alumni breakout)
  - CASE VSE institution-level data is subscription-only (CASE member portal)
  - US News publishes alumni giving rates per profile page but has no public API
  - Neither IPEDS nor College Scorecard publishes 6-month employment rates
    (NACE first-destination surveys are per-school, not centralized)
So both fields stay synthetic, honestly labeled, with per-record _source fields
mirroring the _endowment_source / _research_source convention (source field
follows its base field).

Idempotent: safe to re-run; verifies 249/249 records, distinct ids/Scorecard IDs.
"""
import json
from collections import OrderedDict

PATH = "data/universities.json"

ALUMNI_SRC = "synthetic (placeholder)"
EMP_SRC = "synthetic (placeholder)"

def main():
    with open(PATH) as f:
        d = json.load(f, object_pairs_hook=OrderedDict)
    recs = d["universities"]
    assert len(recs) == 249, f"expected 249 records, got {len(recs)}"
    for r in recs:
        # insert _alumni_giving_source right after alumni_giving
        items = list(r.items())
        out = OrderedDict()
        for k, v in items:
            out[k] = v
            if k == "alumni_giving":
                out["_alumni_giving_source"] = ALUMNI_SRC
            if k == "employment_6mo":
                out["_employment_6mo_source"] = EMP_SRC
        # sanity: both landed
        assert out["_alumni_giving_source"] == ALUMNI_SRC
        assert out["_employment_6mo_source"] == EMP_SRC
        r.clear()
        r.update(out)
    ids = [r["id"] for r in recs]
    scids = [r["scorecard_id"] for r in recs]
    assert len(set(ids)) == 249, "duplicate internal ids"
    assert len(set(scids)) == 249, "duplicate Scorecard IDs"
    d["metadata"]["version"] = "0.34"
    d["metadata"]["last_updated"] = "2026-09-26"
    with open(PATH, "w") as f:
        json.dump(d, f, indent=2)
        f.write("\n")
    print(f"labeled 249/249 records; ids distinct={len(set(ids))==249}, scorecard distinct={len(set(scids))==249}")

if __name__ == "__main__":
    main()
