#!/usr/bin/env python3
"""v0.16: hbcusample identity cleanup.
The record with id 'hbcusample' displayed public name 'HBCU Sample University'
but carried scorecard_id 138947 = Clark Atlanta University, with baselines
blended from another (Georgia Tech-like) institution: control=public,
enrollment_fte 33855 (real 3603), carnegie R1, research_spend_m 416,
alumni_network_k 313, grad_rate 0.72, retention 0.87, endowment 1.2 synthetic.
This run rematches the record to Clark Atlanta University using:
  - College Scorecard API id=138947 (raw: data/raw/collegescorecard/2026-09-08/cau_138947_v16.json)
  - CAU official 2025 Carnegie R2 announcement (research $10.32M FY2023)
  - UNCF member page (private; 29,000+ alumni)
  - IPEDS Finance FY2024 via Data USA (endowment ~$116M)
  - CAU Office of Institutional Research (undergraduate retention 73%)
  - College Board BigFuture (student-faculty ratio 16:1)
Raw web artifacts + sources.json under data/raw/cau-rematch/2026-09-08/.
Guards: assert pre-image values before touching; assert post-image invariants.
Score rescoring happens via scripts/recompute_scores_v10.py afterwards.
"""
import json

DATA = "data/universities.json"

data = json.load(open(DATA))
unis = data["universities"]
assert len(unis) == 200, len(unis)

hits = [u for u in unis if u["id"] == "hbcusample"]
assert len(hits) == 1, f"expected exactly 1 hbcusample, found {len(hits)}"
u = hits[0]

# --- pre-image guard: confirm the record we are fixing ---
assert u["name"] == "HBCU Sample University", u["name"]
assert u["scorecard_id"] == 138947, u["scorecard_id"]
assert u["scorecard_name"] == "Clark Atlanta University", u["scorecard_name"]
assert u["control"] == "public", u["control"]
assert u["enrollment_fte"] == 33855, u["enrollment_fte"]
assert u["carnegie"] == "R1", u["carnegie"]
assert u["research_spend_m"] == 416, u["research_spend_m"]
assert u["alumni_network_k"] == 313, u["alumni_network_k"]
assert u["grad_rate_6yr"] == 0.72, u["grad_rate_6yr"]
assert u["retention"] == 0.87, u["retention"]
assert u["endowment_b"] == 1.2, u["endowment_b"]
assert u["sf_ratio"] == 10, u["sf_ratio"]
assert u["median_earn_10yr"] == 42712 and u["median_earn_10yr_real"] == 42712

# --- corrections ---
u["id"] = "clarkatlanta"
u["name"] = "Clark Atlanta University"
u["control"] = "private"          # Scorecard ownership=2 (private nonprofit); UNCF: "private, coeducational"
u["carnegie"] = "R2"              # CAU official: 2025 Carnegie "Research 2: High Spending and Doctorate Production"
u["enrollment_fte"] = 3603        # Scorecard latest.student.size (real)
u["grad_rate_6yr"] = 0.4902       # Scorecard latest.completion.completion_rate_4yr_150nt (real)
u["retention"] = 0.73             # CAU Office of Institutional Research (Scorecard retention field absent)
u["sf_ratio"] = 16                # College Board BigFuture 16:1 (secondary; IPEDS-direct flagged for future)
u["endowment_b"] = 0.116          # IPEDS Finance FY2024 ~$116M via Data USA (not NACUBO participant)
u["_endowment_source"] = "IPEDS Finance FY2024 via Data USA (not NACUBO participant)"
u["endowment_per_student"] = round(116_000_000 / 3603)  # = 32195
u["research_spend_m"] = 10.32     # CAU official: $10,320,000 FY2023
u["alumni_network_k"] = 29        # UNCF: "more than 29,000 alumni"
u["_identity_source"] = ("v0.16 rematch: Scorecard id 138947 = Clark Atlanta University "
                         "(was 'HBCU Sample University'); raw artifacts data/raw/cau-rematch/2026-09-08/")

# status-quo fields (kept; already consistent with CAU Scorecard identity)
assert u["median_earn_10yr_real"] == 42712
assert u["debt_avg_real"] == 27000
assert u["net_price_avg_real"] == 37702
assert u["enrollment_fte_real"] == 3603
assert u["admission_rate"] == 0.6422
assert u["pell_rate"] == 0.7047
assert u["avg_family_income"] == 39012
assert u["conference"] == "SIAC"   # correct athletic conference for CAU
assert u["state"] == "GA"

# loan_default: fresh Scorecard pull returned 0 (implausible for 70% Pell; likely suppressed).
# Keep 0.029 status quo; flagged in iteration log for future audit.
assert u["loan_default"] == 0.029

# --- post-image invariants ---
assert u["id"] == "clarkatlanta"
assert u["endowment_per_student"] == 32195
ids = [x["id"] for x in unis]
assert len(set(ids)) == 200, "duplicate ids after rename"
assert all(x.get("scorecard_id") for x in unis)

json.dump(data, open(DATA, "w"), indent=1)
print("fixed record:")
for k in ["id", "name", "control", "carnegie", "enrollment_fte", "endowment_b",
          "endowment_per_student", "grad_rate_6yr", "retention", "sf_ratio",
          "research_spend_m", "alumni_network_k", "loan_default", "conference"]:
    print(f"  {k} = {u[k]}")
print("wrote", DATA)
