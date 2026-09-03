#!/usr/bin/env python3
"""v0.10: declamp score formula. Old formula clamped at 96 -> 21 schools tied at 96.0.
New: compute raw composite for ALL 200, then min-max normalize to [55,97].
Same components/weights as before, no hard cap, so elites differentiate."""
import json
from collections import Counter

DATA = "data/universities.json"

def raw_score(u):
    earn = u.get("median_earn_10yr") or 50000
    gr = u.get("grad_rate_6yr") or 0.6
    ret = u.get("retention") or 0.8
    adm = u.get("admission_rate")
    adm = 0.7 if adm is None else adm
    b = 60 + (earn - 45000) / 1200 * 0.8 + gr * 15 + ret * 8 + (1 - adm) * 6
    if u.get("control") == "private" and u.get("carnegie") == "Baccalaureate":
        b += 3
    return b

data = json.load(open(DATA))
unis = data["universities"]
assert len(unis) == 200, len(unis)

raws = [(u, raw_score(u)) for u in unis]
lo = min(r for _, r in raws)
hi = max(r for _, r in raws)
print(f"raw range: {lo:.1f} .. {hi:.1f}")

LO, HI = 55.0, 97.0
for u, r in raws:
    u["score"] = round(LO + (r - lo) / (hi - lo) * (HI - LO), 1)

scores = [u["score"] for u in unis]
c = Counter(scores)
print("score range:", min(scores), max(scores))
print("max tie count:", c.most_common(3))
print("top 10:")
for u in sorted(unis, key=lambda x: -x["score"])[:10]:
    print(f"  {u['score']:.1f} {u['name']} earn={u['median_earn_10yr']} grad={u['grad_rate_6yr']}")
print("bottom 5:")
for u in sorted(unis, key=lambda x: x["score"])[:5]:
    print(f"  {u['score']:.1f} {u['name']}")

json.dump(data, open(DATA, "w"), indent=1)
print("wrote", DATA)
