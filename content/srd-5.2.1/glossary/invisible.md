# Invisible [Condition]
**Type:** Rule
**Source:** SRD 5.2.1, p. 184

While you have the Invisible condition, you experience the following effects.

***Surprise.*** If you’re Invisible when you roll Initiative, you have Advantage on the roll.

***Concealed.*** You aren’t affected by any effect that requires its target to be seen unless the effect’s creator can somehow see you. Any equipment you are wearing or carrying is also concealed.

***Attacks Affected.*** Attack rolls against you have Disadvantage, and your attack rolls have Advantage. If a creature can somehow see you, you don’t gain this benefit against that creature.

## Effects
```yaml
- advantage: { roll: initiative }
- disadvantage: { roll: attacks-against-you, when: { player: "The attacker can't see you" } }
- advantage: { roll: attack, when: { player: "The target can't see you" } }
- trait: [concealed]
```
