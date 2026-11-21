# Foresight
**Type:** Spell
**Source:** SRD 5.2.1, p. 134
*Level 9 Divination (Bard, Druid, Warlock, Wizard)*
**Casting Time:** 1 minute
**Range:** Touch
**Components:** V, S, M (a hummingbird feather)
**Duration:** 8 hours

You touch a willing creature and bestow a limited ability to see into the immediate future. For the duration, the target has Advantage on D20 Tests, and other creatures have Disadvantage on attack rolls against it. The spell ends early if you cast it again.

## Effects
```yaml
- action: { range: touch, targets: { count: 1, creature: willing } }
- target-effects: { effects: [ { advantage: { roll: d20 } }, { disadvantage: { roll: attacks-against-you } } ] }
```
