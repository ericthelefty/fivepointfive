# Vitriolic Sphere
**Type:** Spell
**Source:** SRD 5.2.1, p. 172
*Level 4 Evocation (Sorcerer, Wizard)*
**Casting Time:** Action
**Range:** 150 feet
**Components:** V, S, M (a drop of bile)
**Duration:** Instantaneous

You point at a location within range, and a glowing, 1-foot-diameter ball of acid streaks there and explodes in a 20-foot-radius Sphere. Each creature in that area makes a Dexterity saving throw. On a failed save, a creature takes 10d4 Acid damage and another 5d4 Acid damage at the end of its next turn. On a successful save, a creature takes half the initial damage only.

***Using a Higher-Level Spell Slot.*** The initial damage increases by 2d4 for each spell slot level above 4.

## Effects
```yaml
- action: { area: { shape: sphere, size: 20 }, save: { ability: dex, success: half }, damage: { dice: 10d4, type: acid },
            on-failure: { then: { at: end-of-target-next-turn, damage: { dice: 5d4, type: acid } } } }
- scaling: { per-slot-above: 4, add: { damage: 2d4 } }
```
