# Potion of Heroism
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 236
*Potion, Rare*

When you drink this potion, you gain 10 Temporary Hit Points that last for 1 hour. For the same duration, you are under the effect of the *Bless* spell (no Concentration required).

This potion’s blue liquid bubbles and steams as if boiling.

## Effects
```yaml
- action: { activation: bonus, consume: true, temp-hp: 10, duration: { amount: 1, unit: hour }, cast: $srd/spells/bless, overrides: { concentration: false, target: self } }
```
