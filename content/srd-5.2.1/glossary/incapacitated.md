# Incapacitated [Condition]
**Type:** Rule
**Source:** SRD 5.2.1, p. 184

While you have the Incapacitated condition, you experience the following effects.

***Inactive.*** You can’t take any action, Bonus Action, or Reaction.

***No Concentration.*** Your Concentration is broken.

***Speechless.*** You can’t speak.

***Surprised.*** If you’re Incapacitated when you roll Initiative, you have Disadvantage on the roll.

## Effects
```yaml
- trait: [no-action, no-bonus-action, no-reaction, cant-speak]
- breaks-concentration: true
- disadvantage: { roll: initiative }
```
