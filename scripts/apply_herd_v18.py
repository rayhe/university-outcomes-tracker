#!/usr/bin/env python3
"""apply_herd_v18.py — Apply the HUMAN-REVIEWED herd_match_review_v18.tsv.

For each approved ALIAS/AUTO row: research_spend_m <- HERD FY2024 total R&D ($M),
_research_source/_research_rank/_research_herd_name annotated, filings.herd -> 2024.
UNMATCHED rows keep synthetic with explicit placeholder source.
Also fixes 3 stale state fields caught during review (wesleyan VA->CT,
colby NH->ME, dayton FL->OH — city+Scorecard name confirm).

Scores NOT recomputed: v0.10 formula does not use research_spend_m.
"""
import json, os

REPO = os.path.expanduser("~/repos/university-outcomes-tracker")
GOAL_HIDDEN = os.path.expanduser("~/workspace/goals/university-outcomes-tracker/hidden_files")
DATA = os.path.join(REPO, "data", "universities.json")
TSV = os.path.join(GOAL_HIDDEN, "herd_match_review_v18.tsv")

SRC = "NSF HERD FY2024 (nsf26304 Table 19), total R&D expenditures"

SCOPE = {
    "pennstate": "HERD reporting unit: University Park + Hershey Medical Center",
    "texasa&m": "HERD reporting unit: College Station + Health Science Center",
    "vanderbilt": "HERD reporting unit: university + medical center",
    "dartmouth": "HERD reporting unit: college + Hitchcock Medical Center",
    "nebraska": "HERD reporting unit: Lincoln + Medical Center",
}

STATE_FIX = {"wesleyan": "CT", "colby": "ME", "dayton": "OH"}

def main():
    rows = {}
    with open(TSV) as f:
        header = f.readline()
        for line in f:
            p = line.rstrip("\n").split("\t")
            rows[p[0]] = p  # our_id -> columns

    d = json.load(open(DATA))
    recs = d["universities"]
    assert len(recs) == 200
    n_real = n_synth = 0
    for r in recs:
        rid = r["id"]
        cols = rows.get(rid)
        assert cols is not None, f"no review row for {rid}"
        our_id, our_name, state, herd_name, herd_rd_m, herd_rank, method, note = cols
        if method in ("ALIAS", "AUTO_1.00", "AUTO_0.75", "AUTO_0.67", "AUTO_0.62") or method.startswith("AUTO"):
            r["research_spend_m"] = float(herd_rd_m)
            r["_research_source"] = SRC
            r["_research_herd_name"] = herd_name
            r["_research_rank"] = int(herd_rank)
            if rid in SCOPE:
                r["_research_scope"] = SCOPE[rid]
            else:
                r.pop("_research_scope", None)
            r["filings"]["herd"] = "2024"
            n_real += 1
        else:
            r["_research_source"] = "synthetic (placeholder)"
            r.pop("_research_herd_name", None)
            r.pop("_research_rank", None)
            r.pop("_research_scope", None)
            n_synth += 1
        if rid in STATE_FIX and r["state"] != STATE_FIX[rid]:
            print(f"state fix: {rid} {r['state']} -> {STATE_FIX[rid]} ({r['scorecard_city']})")
            r["state"] = STATE_FIX[rid]

    # validation
    ids = [r["id"] for r in recs]
    assert len(set(ids)) == 200, "duplicate ids"
    sids = [r["scorecard_id"] for r in recs]
    assert len(set(sids)) == 200, "duplicate scorecard ids"
    bad = [r["id"] for r in recs if r["research_spend_m"] is None or r["research_spend_m"] < 0]
    assert not bad, bad
    vals = sorted((r["research_spend_m"], r["id"]) for r in recs)
    print(f"applied: {n_real} HERD real, {n_synth} synthetic placeholders")
    print("top5:", [(i, round(v, 1)) for v, i in vals[-5:][::-1]])
    print("bottom5:", [(i, round(v, 1)) for v, i in vals[:5]])
    # absurdity check vs known magnitudes
    assert max(v for v, _ in vals) < 5000, "absurd max"
    d["metadata"]["updated"] = "2026-09-10"
    json.dump(d, open(DATA, "w"), indent=1)
    print("wrote", DATA)

if __name__ == "__main__":
    main()
