# Crystal Ball of Telepathy
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 216
*Wondrous Item, Legendary (Requires Attunement)*

While touching this crystal orb, you can cast *Scrying* (save DC 17) with it. In addition, you can communicate telepathically with creatures you can see within 30 feet of the spell’s sensor. You can also cast *Suggestion* (save DC 17) through the sensor on one of those creatures. You don’t need to concentrate on this *Suggestion* to maintain it during its duration, but it ends if *Scrying* ends. You can’t cast *Suggestion* in this way again until the next dawn.

## Effects
```yaml
- grant-spell: { spell: $srd/spells/scrying, at-will: true, overrides: { dc: 17 } }
- grant-spell: { spell: $srd/spells/suggestion, free: { per: dawn, count: 1 }, overrides: { dc: 17, concentration: false } }
- trait: { text: "Telepathy with creatures you see within 30 feet of the sensor." }
```
