# Burning Hands
**Type:** Spell
**Source:** SRD 5.2.1, p. 114
*Level 1 Evocation (Sorcerer, Wizard)*
**Casting Time:** Action
**Range:** Self
**Components:** V, S
**Duration:** Instantaneous

A thin sheet of flames shoots forth from you. Each creature in a 15-foot Cone makes a Dexterity saving throw, taking 3d6 Fire damage on a failed save or half as much damage on a successful one.

Flammable objects in the Cone that aren’t being worn or carried start burning.

***Using a Higher-Level Spell Slot.*** The damage increases by 1d6 for each spell slot level above 1.

## Effects
```yaml
- action: { area: { shape: cone, size: 15 }, save: { ability: dex, success: half }, damage: { dice: 3d6, type: fire } }
- scaling: { per-slot-above: 1, add: { damage: 1d6 } }
```
