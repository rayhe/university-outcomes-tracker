# data/raw — fetch artifacts

Every external fetch behind this tracker is persisted here as a committed
artifact, so provenance is traceable in git history instead of living in
ephemeral HTTP logs.

## Layout

```
data/raw/<source>/<YYYY-MM-DD>/<name>.json
```

- `<source>`: `collegescorecard`, `ipeds`, `irs990`, `nacubo`, `herd`, ...
- `<YYYY-MM-DD>`: UTC date of the fetch
- `<name>.json`: per-record name, e.g. `243744-stanford.json`

## Envelope

Each file wraps the raw response with a `_fetch_meta` header:

```json
{
  "_fetch_meta": {
    "source": "collegescorecard",
    "endpoint": "https://api.data.gov/...?api_key=REDACTED&...",
    "params": {"id": 243744, "fields": "..."},
    "fetched_at": "2026-09-03T15:00:00+00:00",
    "note": "stanford / Stanford University"
  },
  "response": { ...raw API JSON... }
}
```

Secrets (api keys, tokens) are redacted before writing. The raw response
itself is stored verbatim — no cleaning, no merging.

## Rule

All fetch scripts MUST write through `scripts/raw_artifact.py::save_raw`.
See `scripts/README.md`.
