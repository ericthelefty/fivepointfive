# Protection from Energy
**Type:** Spell
**Source:** SRD 5.2.1, p. 157
*Level 3 Abjuration (Cleric, Druid, Ranger, Sorcerer, Wizard)*
**Casting Time:** Action
**Range:** Touch
**Components:** V, S
**Duration:** Concentration, up to 1 hour

For the duration, the willing creature you touch has Resistance to one damage type of your choice: Acid, Cold, Fire, Lightning, or Thunder.

## Effects
```yaml
- action: { range: touch, targets: { count: 1, creature: willing }, choose: { id: energy, kind: damage-type, from: [acid, cold, fire, lightning, thunder] } }
- target-effects: { effects: [ { defense: { resistance: [choice:energy] } } ] }
```
