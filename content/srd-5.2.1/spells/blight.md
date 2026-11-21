# Blight
**Type:** Spell
**Source:** SRD 5.2.1, p. 113
*Level 4 Necromancy (Druid, Sorcerer, Warlock, Wizard)*
**Casting Time:** Action
**Range:** 30 feet
**Components:** V, S
**Duration:** Instantaneous

A creature that you can see within range makes a Constitution saving throw, taking 8d8 Necrotic damage on a failed save or half as much damage on a successful one. A Plant creature automatically fails the save.

Alternatively, target a nonmagical plant that isn’t a creature, such as a tree or shrub. It doesn’t make a save; it simply withers and dies.

***Using a Higher-Level Spell Slot.*** The damage increases by 1d8 for each spell slot level above 4.

## Effects
```yaml
- action: { targets: { count: 1 }, save: { ability: con, success: half, auto-fail: { creature: plant } }, damage: { dice: 8d8, type: necrotic } }
- scaling: { per-slot-above: 4, add: { damage: 1d8 } }
```
