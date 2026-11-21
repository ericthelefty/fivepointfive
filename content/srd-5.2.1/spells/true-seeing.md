# True Seeing
**Type:** Spell
**Source:** SRD 5.2.1, p. 171
*Level 6 Divination (Bard, Cleric, Sorcerer, Warlock, Wizard)*
**Casting Time:** Action
**Range:** Touch
**Components:** V, S, M (mushroom powder worth 25+ GP, which the spell consumes)
**Duration:** 1 hour

For the duration, the willing creature you touch has Truesight with a range of 120 feet.

## Effects
```yaml
- action: { range: touch, targets: { count: 1, creature: willing } }
- target-effects: { effects: [ { sense: { truesight: 120 } } ] }
```
