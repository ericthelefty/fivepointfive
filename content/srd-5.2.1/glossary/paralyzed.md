# Paralyzed [Condition]
**Type:** Rule
**Source:** SRD 5.2.1, p. 186

While you have the Paralyzed condition, you experience the following effects.

***Incapacitated.*** You have the Incapacitated condition.

***Speed 0.*** Your Speed is 0 and can’t increase.

***Saving Throws Affected.*** You automatically fail Strength and Dexterity saving throws.

***Attacks Affected.*** Attack rolls against you have Advantage.

***Automatic Critical Hits.*** Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you.

## Effects
```yaml
- condition: [incapacitated]
- set: { to: speed:all, value: 0, mode: override, locked: true }
- auto-fail: { roll: [save:str, save:dex] }
- advantage: { roll: attacks-against-you }
- treat-roll: { roll: hits-against-you, as: crit, when: { player: "The attacker is within 5 feet" } }
```
