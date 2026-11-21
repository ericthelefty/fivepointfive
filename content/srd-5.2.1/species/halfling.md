# Halfling
**Type:** Species
**Source:** SRD 5.2.1, p. 86
**Creature Type:** Humanoid
**Size:** Small (about 2–3 feet tall)
**Speed:** 30 feet

As a Halfling, you have these special traits.

## Brave

You have Advantage on saving throws you make to avoid or end the Frightened condition.

## Effects
```yaml
- advantage: { roll: save:all, scope: { against: { condition: frightened } } }
```

## Halfling Nimbleness

You can move through the space of any creature that is a size larger than you, but you can’t stop in the same space.

## Effects
```yaml
- trait: { text: "You can move through the space of any creature a size larger than you, but can't stop there." }
```

## Luck

When you roll a 1 on the d20 of a D20 Test, you can reroll the die, and you must use the new roll.

## Effects
```yaml
- reroll: { roll: d20, if: 1, must-use-new: true }
```

## Naturally Stealthy

You can take the Hide action even when you are obscured only by a creature that is at least one size larger than you.

## Effects
```yaml
- trait: { text: "You can take the Hide action when obscured only by a creature at least one size larger than you." }
```
