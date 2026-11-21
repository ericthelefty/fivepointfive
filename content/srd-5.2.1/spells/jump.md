# Jump
**Type:** Spell
**Source:** SRD 5.2.1, p. 143
*Level 1 Transmutation (Druid, Ranger, Sorcerer, Wizard)*
**Casting Time:** Bonus Action
**Range:** Touch
**Component:** V, S, M (a grasshopper’s hind leg)
**Duration:** 1 minute

You touch a willing creature. Once on each of its turns until the spell ends, that creature can jump up to 30 feet by spending 10 feet of movement.

***Using a Higher-Level Spell Slot.*** You can target one additional creature for each spell slot level above 1.

## Effects
```yaml
- action: { range: touch, targets: { count: 1, creature: willing } }
- target-effects: { effects: [ { trait: { text: "Once each turn: jump up to 30 feet for 10 feet of movement." } } ] }
- scaling: { per-slot-above: 1, add: { targets: 1 } }
```
