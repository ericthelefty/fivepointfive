# Inflict Wounds
**Type:** Spell
**Source:** SRD 5.2.1, p. 143
*Level 1 Necromancy (Cleric)*
**Casting Time:** Action
**Range:** Touch
**Components:** V, S
**Duration:** Instantaneous

A creature you touch makes a Constitution saving throw, taking 2d10 Necrotic damage on a failed save or half as much damage on a successful one.

***Using a Higher-Level Spell Slot.*** The damage increases by 1d10 for each spell slot level above 1.

## Effects
```yaml
- action: { range: touch, save: { ability: con, success: half }, damage: { dice: 2d10, type: necrotic } }
- scaling: { per-slot-above: 1, add: { damage: 1d10 } }
```
