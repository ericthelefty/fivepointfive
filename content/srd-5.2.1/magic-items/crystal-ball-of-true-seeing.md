# Crystal Ball of True Seeing
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 216
*Wondrous Item, Legendary (Requires Attunement)*

While touching this crystal orb, you can cast *Scrying* (save DC 17) with it. In addition, you have Truesight with a range of 120 feet centered on the spell’s sensor.

## Effects
```yaml
- grant-spell: { spell: $srd/spells/scrying, at-will: true, overrides: { dc: 17 } }
- note: { stat: sense:truesight, text: "Truesight 120 ft centered on the scrying sensor" }
```
