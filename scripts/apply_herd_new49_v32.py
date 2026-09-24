#!/usr/bin/env python3
"""v0.32: HERD FY2024 research_spend_m for the 49 v0.31-added schools.

Hand-adjudicated matches from data/raw/nsf-herd/2026-09-10/herd_table19_parsed.json
(explicit allowlist only - token-overlap matching is unsafe for universities).
12 schools not in the HERD survey keep labeled synthetic placeholders.
"""
import json

MAP = [
    # (record_id, HERD institution name) - HBCUs
    ("floridaam", "Florida A&M U."),
    ("ncat", "North Carolina A&T State U."),
    ("jacksonstate", "Jackson State U."),
    ("southern", "Southern U. and A&M C., Baton Rouge"),
    ("alcorn", "Alcorn State U."),
    ("delawarestate", "Delaware State U."),
    ("morganstate", "Morgan State U."),
    ("prairieview", "Prairie View A&M U."),
    ("tennesseestate", "Tennessee State U."),
    ("texassouthern", "Texas Southern U."),
    ("alabamaam", "Alabama A&M U."),
    ("hampton", "Hampton U."),
    ("tuskegee", "Tuskegee U."),
    ("xavierla", "Xavier U. Louisiana"),
    ("dillard", "Dillard U."),
    ("norfolkstate", "Norfolk State U."),
    ("scstate", "South Carolina State U."),
    ("nccentral", "North Carolina Central U."),
    # LACs
    ("oberlin", "Oberlin C."),
    ("kenyon", "Kenyon C."),
    ("grinnell", "Grinnell C."),
    ("reed", "Reed C."),
    ("whitman", "Whitman C."),
    ("coloradocollege", "Colorado C."),
    ("trinitytx", "Trinity U."),
    ("denison", "Denison U."),
    ("stolaf", "St. Olaf C."),
    ("wooster", "C. Wooster"),
    ("gettysburg", "Gettysburg C."),
    ("fandm", "Franklin and Marshall C."),
    ("dickinson", "Dickinson C."),
    ("lafayette", "Lafayette C."),
    ("bates", "Bates C."),
    ("trinityct", "Trinity C., Hartford"),
    ("conncollege", "Connecticut C."),
    ("skidmore", "Skidmore C."),
    ("union", "Union C., Schenectady"),
]

TRAPS_AVOIDED = {
    "delawarestate": "U. Delaware $465.8M",
    "conncollege": "U. Connecticut $433.6M",
    "trinityct": "Trinity U. (San Antonio) $5.84M",
    "trinitytx": "Trinity C., Hartford $5.07M",
    "lafayette": "U. Louisiana, Lafayette $254.9M",
    "fandm": "Marshall U. $39.2M",
    "tennesseestate": "U. Tennessee, Knoxville $386.9M",
    "scstate": "U. South Carolina, Columbia $277.3M",
    "nccentral": "North Carolina State U. $717.0M",
    "lawrence": "Lawrence Technological U. (different school, not in survey)",
}

SRC = "NSF HERD FY2024 (nsf26304 Table 19), total R&D expenditures"


def main():
    d = json.load(open("data/universities.json"))
    recs = d["universities"]
    herd = json.load(open("data/raw/nsf-herd/2026-09-10/herd_table19_parsed.json"))["institutions"]
    by_name = {h["name"]: h for h in herd}
    assert len(MAP) == len({i for i, _ in MAP}) == 37, "MAP count mismatch"
    report = []
    for rid, hname in MAP:
        r = next(x for x in recs if x["id"] == rid)
        assert "_endowment_source" not in r, f"{rid} is not a v0.31-added record"
        h = by_name[hname]
        old = r["research_spend_m"]
        r["research_spend_m"] = h["rd_m"]
        r["_research_source"] = SRC
        r["_research_herd_name"] = h["name"]
        r["_research_rank"] = h["overall_rank"]
        if r.get("filings"):
            r["filings"]["herd"] = "2024"
        if rid == "southern":
            r["_research_scope"] = (
                "Baton Rouge main campus unit; the separate Agricultural Research and "
                "Extension Center ($9.0M) reports separately in HERD"
            )
        report.append(f"{rid:15s} {old} -> {h['rd_m']}M  ({h['name']}, rank {h['overall_rank']})")
    # label the 12 not in the survey
    mapped = {i for i, _ in MAP}
    not_in = [r for r in recs if "_endowment_source" not in r and r["id"] not in mapped]
    for r in not_in:
        r["_research_source"] = "synthetic (placeholder)"
        r.pop("_research_herd_name", None)
        r.pop("_research_rank", None)
    d["metadata"]["version"] = "0.32"
    d["metadata"]["last_updated"] = "2026-09-24"
    json.dump(d, open("data/universities.json", "w"), indent=1, ensure_ascii=True)
    print("\n".join(report))
    print(f"\napplied {len(report)} HERD matches, {len(not_in)} keep synthetic placeholder: "
          + ", ".join(r["id"] for r in not_in))


if __name__ == "__main__":
    main()
