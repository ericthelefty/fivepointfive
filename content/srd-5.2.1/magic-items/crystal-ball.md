# Crystal Ball
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 216
*Wondrous Item, Very Rare (Requires Attunement)*

While touching this crystal orb, you can cast *Scrying* (save DC 17) with it.

## Effects
```yaml
- grant-spell: { spell: $srd/spells/scrying, at-will: true, overrides: { dc: 17 } }
```
