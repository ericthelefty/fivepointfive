# False Life
**Type:** Spell
**Source:** SRD 5.2.1, p. 129
*Level 1 Necromancy (Sorcerer, Wizard)*
**Casting Time:** Action
**Range:** Self
**Components:** V, S, M (a drop of alcohol)
**Duration:** Instantaneous

You gain 2d4 + 4 Temporary Hit Points.

***Using a Higher-Level Spell Slot.*** You gain 5 additional Temporary Hit Points for each spell slot level above 1.

## Effects
```yaml
- action: { targets: { choose: self }, temp-hp: 2d4 + 4 }
- scaling: { per-slot-above: 1, add: { temp-hp: 5 } }
```
