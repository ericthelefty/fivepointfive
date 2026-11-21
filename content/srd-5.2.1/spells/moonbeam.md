# Moonbeam
**Type:** Spell
**Source:** SRD 5.2.1, p. 150
*Level 2 Evocation (Druid)*
**Casting Time:** Action
**Range:** 120 feet
**Components:** V, S, M (a moonseed leaf)
**Duration:** Concentration, up to 1 minute

A silvery beam of pale light shines down in a 5-foot-radius, 40-foot-high Cylinder centered on a point within range. Until the spell ends, Dim Light fills the Cylinder, and you can take a Magic action on later turns to move the Cylinder up to 60 feet.

When the Cylinder appears, each creature in it makes a Constitution saving throw. On a failed save, a creature takes 2d10 Radiant damage, and if the creature is shape-shifted (as a result of the *Polymorph* spell, for example), it reverts to its true form and can’t shape-shift until it leaves the Cylinder. On a successful save, a creature takes half as much damage only. A creature also makes this save when the spell’s area moves into its space and when it enters the spell’s area or ends its turn there. A creature makes this save only once per turn.

***Using a Higher-Level Spell Slot.*** The damage increases by 1d10 for each spell slot level above 2.

## Effects
```yaml
- zone: { area: { shape: cylinder, size: 5, height: 40 }, event: [cast, enter-area, end-of-turn, moved-into], per: turn,
          save: { ability: con, success: half }, damage: { dice: 2d10, type: radiant },
          on-failure: { text: "A shape-shifted creature reverts and can't shape-shift while inside." },
          moves: { activation: magic, distance: 60 }, effects: [ { trait: { light: { dim: fill } } } ] }
- scaling: { per-slot-above: 2, add: { damage: 1d10 } }
```
