# Invisibility
**Type:** Spell
**Source:** SRD 5.2.1, p. 143
*Level 2 Illusion (Bard, Sorcerer, Warlock, Wizard)*
**Casting Time:** Action
**Range:** Touch
**Components:** V, S, M (an eyelash in gum arabic)
**Duration:** Concentration, up to 1 hour

A creature you touch has the Invisible condition until the spell ends. The spell ends early immediately after the target makes an attack roll, deals damage, or casts a spell.

***Using a Higher-Level Spell Slot.*** You can target one additional creature for each spell slot level above 2.

## Effects
```yaml
- action: { range: touch, targets: { count: 1 }, apply: { condition: invisible, duration: spell, ends-when: [attack, damage, cast] } }
- scaling: { per-slot-above: 2, add: { targets: 1 } }
```
