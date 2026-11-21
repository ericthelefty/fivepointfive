# Crystal Ball of Mind Reading
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 216
*Wondrous Item, Legendary (Requires Attunement)*

While touching this crystal orb, you can cast *Scrying* (save DC 17) with it. In addition, you can cast *Detect Thoughts* (save DC 17) targeting creatures you can see within 30 feet of the spell’s sensor. You don’t need to concentrate on this *Detect Thoughts* spell to maintain it during its duration, but it ends if the *Scrying* spell ends.

## Effects
```yaml
- grant-spell: { spell: $srd/spells/scrying, at-will: true, overrides: { dc: 17 } }
- grant-spell: { spell: $srd/spells/detect-thoughts, at-will: true, overrides: { dc: 17, concentration: false, text: "Through the scrying sensor; ends with Scrying" } }
```
