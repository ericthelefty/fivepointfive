# Modif tools

Python 3 with `pyyaml`; install `jsonschema` too for the value checks (`pip install pyyaml jsonschema`).

| File | What it does |
|---|---|
| `modif_check.py` | Validates Modif. `python3 tools/modif_check.py` checks the `## Effects` blocks in the SRD pack; pass another pack folder, or a folder of `.yaml` drafts, to check that instead. Exits non-zero on any issue. |
| `modif.schema.json` | JSON Schema 2020-12 for Effects blocks. `modif_check.py` uses it when `jsonschema` is installed. |
| `build_schema.py` | Regenerates `modif.schema.json` from the validator's vocabulary: `cd tools && python3 build_schema.py`. Run it after changing the vocabulary in `modif_check.py`. |
| `insert_effects.py` | Inserts blocks from a draft YAML file into an entry file: `python3 tools/insert_effects.py <entry.md> <draft.yaml>`. Each top-level key is a feature heading (without "Level N: ") or the entry's name. Turn run-in traits into headings first. |
| `insert_catalog.py` | Moves drafts keyed by entry slug (spells, magic items) into the pack: `python3 tools/insert_catalog.py content/srd-5.2.1 spells <draft.yaml>…`. Skips entries that already have Effects. |

The spec is [`docs/MODIF.md`](../docs/MODIF.md); the conversion workflow is [`docs/CONVERTING_TO_MODIF.md`](../docs/CONVERTING_TO_MODIF.md).
