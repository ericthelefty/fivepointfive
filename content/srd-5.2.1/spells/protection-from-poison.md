# Protection from Poison
**Type:** Spell
**Source:** SRD 5.2.1, p. 157
*Level 2 Abjuration (Cleric, Druid, Paladin, Ranger)*
**Casting Time:** Action
**Range:** Touch
**Components:** V, S
**Duration:** 1 hour

You touch a creature and end the Poisoned condition on it. For the duration, the target has Advantage on saving throws to avoid or end the Poisoned condition, and it has Resistance to Poison damage.

## Effects
```yaml
- action: { range: touch, targets: { count: 1 }, remove-condition: [poisoned] }
- target-effects: { effects: [ { defense: { resistance: [poison] } }, { advantage: { roll: save:all, scope: { against: { condition: poisoned } } } } ] }
```
