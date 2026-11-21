# Potion of Gaseous Form
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 235
*Potion, Rare*

When you drink this potion, you gain the effect of the *Gaseous Form* spell for 1 hour (no Concentration required) or until you end the effect as a Bonus Action.

This potion’s container seems to hold fog that moves and pours like water.

## Effects
```yaml
- action: { activation: bonus, consume: true, cast: $srd/spells/gaseous-form, overrides: { concentration: false, duration: { amount: 1, unit: hour } } }
```
