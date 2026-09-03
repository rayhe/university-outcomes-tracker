#!/usr/bin/env python3
"""Backfill data/raw/collegescorecard/<today>/ with the raw API response per school.

Re-fetches all 200 schools by Scorecard ID and persists each raw response via
raw_artifact.save_raw(). Idempotent: skips files already present for today.
Does NOT modify data/universities.json.
"""
import json
import os
import sys
import time
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from raw_artifact import save_raw, fetch_json, raw_path  # noqa: E402

REPO = os.path.expanduser("~/repos/university-outcomes-tracker")
FIELDS = ",".join([
    "id", "school.name", "school.city", "school.state", "school.ownership",
    "latest.earnings.10_yrs_after_entry.median", "latest.earnings.6_yrs_after_entry.median",
    "latest.aid.median_debt.completers.overall", "latest.repayment.3_yr_default_rate",
    "latest.cost.avg_net_price.overall", "latest.cost.avg_net_price.public",
    "latest.cost.avg_net_price.private", "latest.student.size",
    "latest.admissions.admission_rate.overall",
    "latest.completion.retention_rate.four_year.full_time",
    "latest.aid.pell_grant_rate", "latest.student.demographics.avg_family_income",
    "latest.completion.completion_rate_4yr_150nt",
])


def main():
    data = json.load(open(os.path.join(REPO, "data/universities.json")))
    unis = data["universities"]
    ok, skipped, failed = 0, 0, []
    for u in unis:
        sid = u.get("scorecard_id")
        if not sid:
            failed.append((u["id"], "no scorecard_id"))
            continue
        name = "%s-%s" % (sid, u["id"])
        if os.path.exists(raw_path("collegescorecard", name)):
            skipped += 1
            continue
        url = ("https://api.data.gov/ed/collegescorecard/v1/schools"
               "?api_key=DEMO_KEY&id=%s&fields=%s" % (sid, urllib.parse.quote(FIELDS)))
        saved = False
        for attempt in range(4):
            try:
                payload, _ = fetch_json(url)
                if payload.get("results"):
                    save_raw("collegescorecard", name, payload, url=url,
                             params={"id": sid, "fields": FIELDS},
                             note="%s / %s" % (u["id"], u.get("scorecard_name")))
                    ok += 1
                    saved = True
                    break
                print("  empty results %s (attempt %d)" % (u["id"], attempt))
            except Exception as e:
                print("  err %s attempt %d: %s" % (u["id"], attempt, e))
            time.sleep(2 ** attempt)
        if not saved:
            failed.append((u["id"], "fetch failed"))
        time.sleep(0.5)
    print("BACKFILL DONE ok=%d skipped=%d failed=%d" % (ok, skipped, len(failed)))
    for fid, why in failed:
        print("  MISS: %s (%s)" % (fid, why))


if __name__ == "__main__":
    main()
