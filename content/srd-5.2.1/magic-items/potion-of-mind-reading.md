# Potion of Mind Reading
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 236
*Potion, Rare*

When you drink this potion, you gain the effect of the *Detect Thoughts* spell (save DC 13) for 10 minutes (no Concentration required).

This potion’s dense, purple liquid has an ovoid cloud of pink floating in it.

## Effects
```yaml
- action: { activation: bonus, consume: true, cast: $srd/spells/detect-thoughts, overrides: { dc: 13, concentration: false, duration: { amount: 10, unit: minute } } }
```
