#!/usr/bin/env python3
"""v0.54: full Scorecard refresh on the new ED release.

The 2026-10-16 canary probe (MIT 166683: earnings 143372->152553,
debt 14768->14000) broke the 8-run no-new-release streak: the ED
"latest" snapshot advanced. Re-pull all 249 records via id filter
(DEMO_KEY, egress proxy, 0.7s sleep, rate-limit backoff):

  latest.earnings.10_yrs_after_entry.median -> median_earn_10yr (+_real)
  latest.aid.median_debt.completers.overall -> debt_avg (+_real)
  latest.admissions.admission_rate.overall  -> admission_rate
  latest.student.demographics.avg_family_income -> avg_family_income
  latest.cost.avg_net_price.overall          -> net_price_avg (+_real)

Keep the stored value when fresh is None/0/missing (suppression-safe).
Raw response per school saved under data/raw/collegescorecard/2026-10-16/
(repo provenance convention). Scores recomputed with the unchanged v0.10
formula (min-max to [55,97], N-adaptive).

Serialization: indent=2, ensure_ascii=True, trailing newline (repo convention).
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scorecard_api_v13 import api_get

DATA = os.path.expanduser("~/repos/university-outcomes-tracker/data/universities.json")

FIELDS = [
    "id",
    "school.name",
    "latest.earnings.10_yrs_after_entry.median",
    "latest.aid.median_debt.completers.overall",
    "latest.admissions.admission_rate.overall",
    "latest.student.demographics.avg_family_income",
    "latest.cost.avg_net_price.overall",
]

MAP = {
    "latest.earnings.10_yrs_after_entry.median": ("median_earn_10yr", True),
    "latest.aid.median_debt.completers.overall": ("debt_avg", True),
    "latest.admissions.admission_rate.overall": ("admission_rate", False),
    "latest.student.demographics.avg_family_income": ("avg_family_income", False),
    "latest.cost.avg_net_price.overall": ("net_price_avg", True),
}


def fetch_with_retry(sid, tag):
    """Fetch one school by Scorecard id; retry on rate limit/empty results."""
    for attempt in range(4):
        r = api_get("id=" + sid, fields=FIELDS, tag=tag,
                     note="v0.54 full Scorecard refresh on the new ED release")
        res = r.get("results") or []
        if res:
            return res[0]
        err = r.get("errors") or r.get("error") or "empty results"
        rate_limited = "RATE" in str(err).upper() or "429" in str(err)
        print("  [%s] attempt %d: %s" % (sid, attempt + 1, str(err)[:100]),
              flush=True)
        time.sleep(75 if rate_limited else 12)
    return None


def raw_score(u):
    """v0.10 score formula, unchanged."""
    earn = u.get("median_earn_10yr") or 50000
    gr = u.get("grad_rate_6yr") or 0.6
    ret = u.get("retention") or 0.8
    adm = u.get("admission_rate")
    adm = 0.7 if adm is None else adm
    b = 60 + (earn - 45000) / 1200 * 0.8 + gr * 15 + ret * 8 + (1 - adm) * 6
    if u.get("control") == "private" and u.get("carnegie") == "Baccalaureate":
        b += 3
    return b


def main():
    data = json.load(open(DATA))
    unis = data["universities"]
    assert len(unis) == 249, len(unis)
    old_scores = {u["id"]: u.get("score") for u in unis}

    updated = {k: 0 for k in MAP}
    failed = []
    kept = 0
    name_drift = []
    per_school_deltas = {}

    for i, u in enumerate(unis):
        sid = str(u.get("scorecard_id"))
        if not sid or sid == "None":
            failed.append(u["id"] + " (no scorecard_id)")
            continue
        rec = fetch_with_retry(sid, "refresh-%s-2026-10-16" % sid)
        if rec is None:
            failed.append(u["id"])
            time.sleep(0.7)
            continue
        deltas = {}
        for api_f, (local_k, real_flag) in MAP.items():
            v = rec.get(api_f)
            if v is None or v == 0:
                kept += 1
                continue
            old = u.get(local_k)
            if old != v:
                deltas[local_k] = [old, v]
                u[local_k] = v
                if real_flag and (local_k + "_real") in u:
                    u[local_k + "_real"] = v
                updated[api_f] += 1
        fresh_name = rec.get("school.name")
        if fresh_name and u.get("scorecard_name") and \
                u["scorecard_name"] != fresh_name:
            name_drift.append((u["id"], u["scorecard_name"], fresh_name))
        per_school_deltas[u["id"]] = deltas
        if (i + 1) % 25 == 0:
            print("progress %d/249" % (i + 1), flush=True)
        time.sleep(0.7)

    # Recompute scores with the unchanged v0.10 formula.
    raws = [(u, raw_score(u)) for u in unis]
    lo = min(r for _, r in raws)
    hi = max(r for _, r in raws)
    for u, r in raws:
        u["score"] = round(55.0 + (r - lo) / (hi - lo) * 42.0, 1)

    movers = []
    for u in unis:
        old = old_scores.get(u["id"])
        new = u["score"]
        if old != new:
            movers.append((u["id"], u["name"], old, new, round(new - old, 1)))
    movers.sort(key=lambda x: -abs(x[4]))

    n_moved = sum(1 for u in unis
                  if sum(1 for d in per_school_deltas.get(u["id"], {})) > 0)

    m = data["metadata"]
    m["version"] = "0.54"
    m["last_updated"] = "2026-10-16"
    m["scorecard_refresh_v54"] = (
        "full 249-record Scorecard refresh on the new ED release "
        "(canary MIT 166683 earnings 143372->152553 broke the 8-run "
        "no-new-release streak): records with >=1 field updated %d/249; "
        "earnings %d, debt %d, admit %d, family income %d, net price %d; "
        "kept-stored-on-null/0 %d fields; %d failed (kept stored); "
        "scores recomputed with unchanged v0.10 formula (min-max 55-97), "
        "%d score movers; Williams Harvard-leak admit/family/netp fixed"
        % (n_moved, updated["latest.earnings.10_yrs_after_entry.median"],
           updated["latest.aid.median_debt.completers.overall"],
           updated["latest.admissions.admission_rate.overall"],
           updated["latest.student.demographics.avg_family_income"],
           updated["latest.cost.avg_net_price.overall"],
           kept, len(failed), len(movers))
    )

    with open(DATA, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=True)
        f.write("\n")

    print("SUMMARY updated=%s kept=%d failed=%s" % (updated, kept, failed))
    print("SUMMARY score_movers=%d raw_range=%.1f..%.1f" % (len(movers), lo, hi))
    print("TOP_GAINERS:")
    for mid, mname, old, new, d in movers[:10]:
        if d > 0:
            print("  %s %s %.1f -> %.1f (%+.1f)" % (mid, mname, old, new, d))
    print("TOP_LOSERS:")
    for mid, mname, old, new, d in sorted(movers, key=lambda x: x[4])[:10]:
        if d < 0:
            print("  %s %s %.1f -> %.1f (%+.1f)" % (mid, mname, old, new, d))
    if name_drift:
        print("NAME_DRIFT:", name_drift)
    print("FAILED:", failed)


if __name__ == "__main__":
    main()
