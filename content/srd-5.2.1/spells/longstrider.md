# Longstrider
**Type:** Spell
**Source:** SRD 5.2.1, p. 145
*Level 1 Transmutation (Bard, Druid, Ranger, Wizard)*
**Casting Time:** Action
**Range:** Touch
**Components:** V, S, M (a pinch of dirt)
**Duration:** 1 hour

You touch a creature. The target’s Speed increases by 10 feet until the spell ends.

***Using a Higher-Level Spell Slot.*** You can target one additional creature for each spell slot level above 1.

## Effects
```yaml
- action: { range: touch, targets: { count: 1 } }
- target-effects: { effects: [ { bonus: { to: speed:walk, value: 10 } } ] }
- scaling: { per-slot-above: 1, add: { targets: 1 } }
```
