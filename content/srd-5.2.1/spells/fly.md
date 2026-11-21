# Fly
**Type:** Spell
**Source:** SRD 5.2.1, p. 133
*Level 3 Transmutation (Sorcerer, Warlock, Wizard)*
**Casting Time:** Action
**Range:** Touch
**Components:** V, S, M (a feather)
**Duration:** Concentration, up to 10 minutes

You touch a willing creature. For the duration, the target gains a Fly Speed of 60 feet and can hover. When the spell ends, the target falls if it is still aloft unless it can stop the fall.

***Using a Higher-Level Spell Slot.*** You can target one additional creature for each spell slot level above 3.

## Effects
```yaml
- action: { range: touch, targets: { count: 1, creature: willing } }
- target-effects: { effects: [ { speed: { fly: 60 } }, { trait: [hover] } ] }
- scaling: { per-slot-above: 3, add: { targets: 1 } }
```
