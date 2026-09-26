# Alumni Giving / Employment 6mo Feasibility Probe — 2026-09-26

**Question:** Can `alumni_giving` (alumni giving rate, 249/249 synthetic) and
`employment_6mo` (6-month employment rate, 249/249 synthetic) be replaced with
real public-source data?

**Answer: No — not via any public API today.** Both fields stay synthetic,
honestly labeled (`synthetic (placeholder)` per-record `_source` + detail-panel
"synthetic placeholder" badge, mirroring the v0.32 research fix). Do not
re-run this probe without a new candidate source.

## alumni_giving (alumni giving RATE — % of alumni who donate)

| Source | Verdict | Why |
|---|---|---|
| IPEDS Finance | NOT USABLE | Collects "private gifts" in aggregate — revenue from private *and affiliated* organizations, foundations, corporations. No alumni breakout. Variables F1A/F2 (e.g. F2H03A "New gifts and additions" is endowment additions, not alumni). Confirmed via IPEDS Finance survey docs (gfoasc.org presentation) and the collegedata-fyi PRD verified against NCES data dictionaries. |
| CASE VSE (Voluntary Support of Education) | NOT PUBLICLY FETCHABLE | The authoritative source of alumni giving data, but institution-level data lives exclusively in the CASE Insights data portal — "Access to the data portal is a CASE member benefit. For-profit corporations can subscribe for a fee." (case.org, VSE survey support page, 2026-09-26). Aggregate-only in public domain. |
| US News rankings profiles | NOT API-ACCESSIBLE | Publishes "alumni giving rate" per school profile page, but there is no public API; per-page scraping of 249 profiles is unreliable and ToS-gray. Not a primary-source path. |
| College Scorecard | NO SUCH FIELD | No alumni giving or donation fields in the Scorecard API dictionary. |
| NACUBO | ENDOWMENT ONLY | No giving-rate data. |
| Wikipedia infoboxes | NO GIVING RATES | (Verified across the v0.19/v0.32 endowment passes — no giving-rate fields.) |

**Bottom line:** the only authoritative source (CASE VSE) is paywalled; the only
public aggregate (IPEDS) is not alumni-specific. A rate cannot be derived from
total private gifts without the alumni donor denominator, which no public
source publishes.

## employment_6mo (6-month post-graduation employment rate)

| Source | Verdict | Why |
|---|---|---|
| IPEDS | NOT USABLE | No IPEDS survey collects post-graduation employment rates. Graduation Rates / Outcome Measures cover completion, transfer, and re-enrollment — not employment. |
| College Scorecard | NO SUCH FIELD | Scorecard has earnings (median_earn_10yr) but no employment-rate field. |
| NACE First Destination Survey | NOT CENTRALIZED | Per-school published reports; no machine-readable national dataset. 249-school manual collection is not feasible in an hourly iteration loop. |

**Bottom line:** no public API serves a 6-month employment rate. Stays synthetic.

## What this run changed (v0.34)

1. `_alumni_giving_source` / `_employment_6mo_source` = `"synthetic (placeholder)"`
   on all 249 records (scripts/apply_synthetic_labels_v34.py).
2. Detail panel Outcomes block shows "(synthetic placeholder)" in gray for both
   fields — same wording as the v0.32 research fix.
3. Methodology cards (index.html) now read "estimated placeholder — no public
   source" / "IPEDS reports total private gifts, not alumni rates; CASE VSE is
   subscription-only" instead of claiming "(IPEDS, CASE)" and "(IPEDS + surveys)".

## Re-probe triggers (only these justify a re-run)

- CASE publishes institution-level VSE data openly (unlikely; data use agreement
  explicitly forbids sharing in the public domain).
- IPEDS adds an alumni-donor breakout to the Finance survey.
- A public API emerges for US News profile fields.
- NACE releases a centralized first-destination dataset.
