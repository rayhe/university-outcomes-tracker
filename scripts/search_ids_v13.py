import time, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from scorecard_api_v13 import api_get

QUERIES = {
    "search-unm-abq": "school.name=University+of+New+Mexico&school.city=Albuquerque",
    "search-osu-corvallis": "school.name=Oregon+State+University&school.city=Corvallis",
    "cur-unm-187620": "id=187620",
    "cur-osu-210429": "id=210429",
}

for tag, q in QUERIES.items():
    try:
        j = api_get(q, tag=tag, note="v0.13 name-search to resolve correct IDs for UNM and Oregon State")
        print(f"== {tag} ==")
        for r in (j.get("results") or [])[:5]:
            print(f"  {r['id']} | {r['school.name']} | {r['school.city']}, {r['school.state']}")
    except Exception as e:
        print(f"== {tag} == ERR {e}")
    time.sleep(0.7)
