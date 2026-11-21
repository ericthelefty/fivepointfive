# Restrained [Condition]
**Type:** Rule
**Source:** SRD 5.2.1, p. 187

While you have the Restrained condition, you experience the following effects.

***Speed 0.*** Your Speed is 0 and can’t increase.

***Attacks Affected.*** Attack rolls against you have Advantage, and your attack rolls have Disadvantage.

***Saving Throws Affected.*** You have Disadvantage on Dexterity saving throws.

## Effects
```yaml
- set: { to: speed:all, value: 0, mode: override, locked: true }
- advantage: { roll: attacks-against-you }
- disadvantage: { roll: [attack, save:dex] }
```
