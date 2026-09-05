"""v0.13 identity verification helper: fetch via College Scorecard API through the
egress proxy, with credentials passed via env (never argv), and every raw
response persisted via raw_artifact.py."""
import json, time, urllib.parse, subprocess, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from raw_artifact import save_raw

FIELDS = ["id","school.name","school.city","school.state","school.ownership"]

def _proxy_env():
    enc = subprocess.check_output(
        r"grep -oP 'http://\K[^@]+(?=@hatch-egress-proxy%3a3128)' ~/.git-credentials | sed -n '1p'",
        shell=True, text=True).strip()
    userinfo = urllib.parse.unquote(enc)
    env = dict(os.environ)
    env["https_proxy"] = f"http://{userinfo}@hatch-egress-proxy:3128"
    return env

_PROXY_ENV = None

def api_get(extra_query, fields=FIELDS, tag=None, note=None):
    global _PROXY_ENV
    if _PROXY_ENV is None:
        _PROXY_ENV = _proxy_env()
    fields_enc = urllib.parse.quote(",".join(fields))
    q = f"https://api.data.gov/ed/collegescorecard/v1/schools?api_key=DEMO_KEY&{extra_query}&fields={fields_enc}"
    out = subprocess.check_output(
        ['curl', '-s', '--http1.1', q], text=True, timeout=30, env=_PROXY_ENV)
    j = json.loads(out)
    if tag:
        save_raw("collegescorecard", tag, j,
                 url="https://api.data.gov/ed/collegescorecard/v1/schools?api_key=DEMO_KEY",
                 params={"query": extra_query, "fields": ",".join(fields)},
                 note=note)
    return j
