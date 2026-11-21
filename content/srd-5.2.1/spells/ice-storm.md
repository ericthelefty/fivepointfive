# Ice Storm
**Type:** Spell
**Source:** SRD 5.2.1, p. 141
*Level 4 Evocation (Druid, Sorcerer, Wizard)*
**Casting Time:** Action
**Range:** 300 feet
**Components:** V, S, M (a mitten)
**Duration:** Instantaneous

Hail falls in a 20-foot-radius, 40-foot-high Cylinder centered on a point within range. Each creature in the Cylinder makes a Dexterity saving throw. A creature takes 2d10 Bludgeoning damage and 4d6 Cold damage on a failed save or half as much damage on a successful one.

Hailstones turn ground in the Cylinder into Difficult Terrain until the end of your next turn.

***Using a Higher-Level Spell Slot.*** The Bludgeoning damage increases by 1d10 for each spell slot level above 4.

## Effects
```yaml
- action: { area: { shape: cylinder, size: 20, height: 40 }, save: { ability: dex, success: half },
            damage: [ { dice: 2d10, type: bludgeoning }, { dice: 4d6, type: cold } ], text: "Difficult Terrain until the end of your next turn." }
- scaling: { per-slot-above: 4, add: { damage: [1d10, 0] } }
```
