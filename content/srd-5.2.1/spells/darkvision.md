# Darkvision
**Type:** Spell
**Source:** SRD 5.2.1, p. 122
*Level 2 Transmutation (Druid, Ranger, Sorcerer, Wizard)*
**Casting Time:** Action
**Range:** Touch
**Components:** V, S, M (a dried carrot)
**Duration:** 8 hours

For the duration, a willing creature you touch has Darkvision with a range of 150 feet.

## Effects
```yaml
- action: { range: touch, targets: { count: 1, creature: willing } }
- target-effects: { effects: [ { sense: { darkvision: 150 } } ] }
```
