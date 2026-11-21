# Draft Modif encodings

Hand-written Modif for the SRD 5.2.1 character content, made while developing the spec (versions 0.3–0.6). They pass `tools/modif_check.py`, but they are **drafts**: check every one against the entry's rules text before moving it into the pack (see [`docs/CONVERTING_TO_MODIF.md`](../docs/CONVERTING_TO_MODIF.md)).

In each file, a top-level key is the feature heading a block list belongs under (without "Level N: "), or the entry name for the entry as a whole. Comments note header fields and other decisions.

| Folder | Contents |
|---|---|
| `characters/` | Every class, subclass and species not yet in the pack, plus `backgrounds.yaml` (Acolyte, Criminal, Sage). |
| `catalog/` | Adventuring gear, tools, equipment rules, conditions, rules and hazards/poisons. |
| `weapon-armor-rows.yaml` | The weapon and armor table rows as structured data (made by a converter, not hand-written). |

**Already in the pack, so not repeated here:** Fighter, Champion, Human, Soldier, all 17 feats, all 339 spells and all 258 magic items. Once an entry is converted, the pack file is the source of truth: delete its draft here in the same change.
