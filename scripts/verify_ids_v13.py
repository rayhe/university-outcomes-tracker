import time, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from scorecard_api_v13 import api_get

CANDIDATES = {
    "uconn": (129020, "University of Connecticut"),
    "unm": (187985, "University of New Mexico-Main Campus"),
    "uva": (234076, "University of Virginia"),
    "rochester": (195030, "University of Rochester"),
    "oregonstate": (209542, "Oregon State University"),
    "southcarolina": (218663, "University of South Carolina"),
    "kentucky": (157085, "University of Kentucky"),
    "auburn": (100858, "Auburn University"),
    "washstate": (236939, "Washington State University"),
    "alabama": (100751, "The University of Alabama"),
    "udel": (130943, "University of Delaware"),
    "georgia": (139959, "University of Georgia"),
}

ok = True
for slug, (sid, exp) in CANDIDATES.items():
    try:
        j = api_get(f"id={sid}", tag=f"idverify-{sid}.json",
                    note="v0.13 identity verification: confirm candidate ID maps to expected main campus")
        r = (j.get("results") or [None])[0]
        if r is None:
            print(f"{slug} {sid} -> NO RESULTS (expect~{exp}) | REVIEW")
            ok = False
            continue
        name, city, st = r["school.name"], r["school.city"], r["school.state"]
        match = exp in name or name.startswith(exp.split(",")[0])
        print(f"{slug} {sid} -> {name} | {city}, {st} | expect~{exp} | {'OK' if match else 'MISMATCH?'}")
        if not match:
            ok = False
    except Exception as e:
        print(f"{slug} {sid} -> ERR {e} | REVIEW")
        ok = False
    time.sleep(0.7)

print("ALL_OK" if ok else "NEEDS_REVIEW")
