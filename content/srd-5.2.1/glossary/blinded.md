# Blinded [Condition]
**Type:** Rule
**Source:** SRD 5.2.1, p. 177

While you have the Blinded condition, you experience the following effects.

***Can’t See.*** You can’t see and automatically fail any ability check that requires sight.

***Attacks Affected.*** Attack rolls against you have Advantage, and your attack rolls have Disadvantage.

## Effects
```yaml
- auto-fail: { roll: check:all, when: { player: "Requires sight" } }
- advantage: { roll: attacks-against-you }
- disadvantage: { roll: attack }
```
