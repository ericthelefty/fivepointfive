# Fireball
**Type:** Spell
**Source:** SRD 5.2.1, p. 131
*Level 3 Evocation (Sorcerer, Wizard)*
**Casting Time:** Action
**Range:** 150 feet
**Components:** V, S, M (a ball of bat guano and sulfur)
**Duration:** Instantaneous

A bright streak flashes from you to a point you choose within range and then blossoms with a low roar into a fiery explosion. Each creature in a 20-foot-radius Sphere centered on that point makes a Dexterity saving throw, taking 8d6 Fire damage on a failed save or half as much damage on a successful one.

Flammable objects in the area that aren’t being worn or carried start burning.

***Using a Higher-Level Spell Slot.*** The damage increases by 1d6 for each spell slot level above 3.

## Effects
```yaml
- action: { area: { shape: sphere, size: 20 }, save: { ability: dex, success: half }, damage: { dice: 8d6, type: fire } }
- scaling: { per-slot-above: 3, add: { damage: 1d6 } }
```
