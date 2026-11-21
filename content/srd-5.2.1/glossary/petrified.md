# Petrified [Condition]
**Type:** Rule
**Source:** SRD 5.2.1, p. 186

While you have the Petrified condition, you experience the following effects.

***Turned to Inanimate Substance.*** You are transformed, along with any nonmagical objects you are wearing and carrying, into a solid inanimate substance (usually stone). Your weight increases by a factor of ten, and you cease aging.

***Incapacitated.*** You have the Incapacitated condition.

***Speed 0.*** Your Speed is 0 and can’t increase.

***Attacks Affected.*** Attack rolls against you have Advantage.

***Saving Throws Affected.*** You automatically fail Strength and Dexterity saving throws.

***Resist Damage.*** You have Resistance to all damage.

***Poison Immunity.*** You have Immunity to the Poisoned condition.

## Effects
```yaml
- condition: [incapacitated]
- set: { to: speed:all, value: 0, mode: override, locked: true }
- advantage: { roll: attacks-against-you }
- auto-fail: { roll: [save:str, save:dex] }
- defense: { resistance: [all], condition-immunity: [poisoned] }
- trait: { text: "Turned to stone with nonmagical gear; weight ×10; doesn't age." }
```
