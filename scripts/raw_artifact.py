#!/usr/bin/env python3
"""raw_artifact.py — persist every external fetch as a committed repo artifact.

Convention (Ray, 2026-09-03): nothing fetched over HTTP may live only in
ephemeral logs or /tmp. Every fetch script must save its raw response under
data/raw/<source>/<YYYY-MM-DD>/<name>.json via save_raw(), so the full
provenance chain is traceable in git history instead of "infinity http requests".

Envelope schema:
{
  "_fetch_meta": {
    "source": "<source>",          # e.g. collegescorecard
    "endpoint": "<url, secrets redacted>",
    "params": {...},               # request params, secrets redacted
    "fetched_at": "<UTC ISO-8601>",
    "note": "<optional human note>"
  },
  "response": <raw parsed JSON, or {"_raw_text": ...} when not JSON>
}
"""
import datetime
import json
import os
import re
import subprocess
import urllib.request

REPO = os.path.expanduser("~/repos/university-outcomes-tracker")
RAW_ROOT = os.path.join(REPO, "data", "raw")

SECRET_KEYS = ("api_key", "apikey", "token", "secret", "password", "auth")


def redact_url(url):
    """Redact secret-ish query params (api_key etc.) before persisting."""
    def _r(m):
        key = m.group(1)
        if any(s in key.lower() for s in SECRET_KEYS):
            return key + "=REDACTED"
        return m.group(0)
    return re.sub(r"([A-Za-z_]+)=[^&]*", _r, url or "")


def _proxy_url():
    """Egress proxy for the Hatch VM. Userinfo comes from ~/.git-credentials
    (same pattern as AGENTS.md) or the HTTPS_PROXY env — never hardcoded."""
    env = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    if env:
        return env
    try:
        out = subprocess.check_output(
            r"grep -oP 'http://\K[^@]+(?=@hatch-egress-proxy%3a3128)'"
            r" ~/.git-credentials | head -n1",
            shell=True, text=True).strip()
        if out:
            return "http://%s@hatch-egress-proxy:3128" % out
    except Exception:
        pass
    return None


def fetch_json(url, timeout=30):
    """GET url (through egress proxy when available). Returns (parsed, body)."""
    proxy = _proxy_url()
    handlers = []
    if proxy:
        handlers.append(urllib.request.ProxyHandler({"http": proxy, "https": proxy}))
    opener = urllib.request.build_opener(*handlers)
    req = urllib.request.Request(url, headers={"User-Agent": "university-outcomes-tracker/1.0"})
    with opener.open(req, timeout=timeout) as r:
        body = r.read()
    try:
        return json.loads(body), body
    except Exception:
        return {"_raw_text": body.decode("utf-8", "replace")}, body


def save_raw(source, name, payload, url=None, params=None, note=None, date=None):
    """Persist a fetch artifact. Returns the written path."""
    day = date or datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    dest_dir = os.path.join(RAW_ROOT, source, day)
    os.makedirs(dest_dir, exist_ok=True)
    if not name.endswith(".json"):
        name += ".json"
    # never persist secrets in the envelope
    safe_params = None
    if params:
        safe_params = {
            k: ("REDACTED" if any(s in k.lower() for s in SECRET_KEYS) else v)
            for k, v in params.items()
        }
    envelope = {
        "_fetch_meta": {
            "source": source,
            "endpoint": redact_url(url) if url else None,
            "params": safe_params,
            "fetched_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "note": note,
        },
        "response": payload,
    }
    path = os.path.join(dest_dir, name)
    with open(path, "w") as f:
        json.dump(envelope, f, indent=2)
    return path


def raw_path(source, name, date=None):
    day = date or datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    if not name.endswith(".json"):
        name += ".json"
    return os.path.join(RAW_ROOT, source, day, name)
