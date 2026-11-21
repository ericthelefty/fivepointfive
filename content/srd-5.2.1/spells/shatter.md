# Shatter
**Type:** Spell
**Source:** SRD 5.2.1, p. 161
*Level 2 Evocation (Bard, Sorcerer, Wizard)*
**Casting Time:** Action
**Range:** 60 feet
**Components:** V, S, M (a chip of mica)
**Duration:** Instantaneous

A loud noise erupts from a point of your choice within range. Each creature in a 10-foot-radius Sphere centered there makes a Constitution saving throw, taking 3d8 Thunder damage on a failed save or half as much damage on a successful one. A Construct has Disadvantage on the save.

A nonmagical object that isn’t being worn or carried also takes the damage if it’s in the spell’s area.

***Using a Higher-Level Spell Slot.*** The damage increases by 1d8 for each spell slot level above 2.

## Effects
```yaml
- action: { area: { shape: sphere, size: 10 }, save: { ability: con, success: half, disadvantage: { creature: construct } }, damage: { dice: 3d8, type: thunder } }
- scaling: { per-slot-above: 2, add: { damage: 1d8 } }
```
