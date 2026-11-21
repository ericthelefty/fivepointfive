# Wall of Fire
**Type:** Spell
**Source:** SRD 5.2.1, p. 172
*Level 4 Evocation (Druid, Sorcerer, Wizard)*
**Casting Time:** Action
**Range:** 120 feet
**Components:** V, S, M (a piece of charcoal)
**Duration:** Concentration, up to 1 minute

You create a wall of fire on a solid surface within range. You can make the wall up to 60 feet long, 20 feet high, and 1 foot thick, or a ringed wall up to 20 feet in diameter, 20 feet high, and 1 foot thick. The wall is opaque and lasts for the duration.

When the wall appears, each creature in its area makes a Dexterity saving throw, taking 5d8 Fire damage on a failed save or half as much damage on a successful one.

One side of the wall, selected by you when you cast this spell, deals 5d8 Fire damage to each creature that ends its turn within 10 feet of that side or inside the wall. A creature takes the same damage when it enters the wall for the first time on a turn or ends its turn there. The other side of the wall deals no damage.

***Using a Higher-Level Spell Slot.*** The damage increases by 1d8 for each spell slot level above 4.

## Effects
```yaml
- action: { area: { choose-on-use: [ { shape: wall, size: 60, height: 20, width: 1 }, { shape: ring, size: 20, height: 20, width: 1 } ] },
            save: { ability: dex, success: half }, damage: { dice: 5d8, type: fire } }
- zone: { side: one, reach: 10, event: [enter-area, end-of-turn], per: turn, damage: { dice: 5d8, type: fire } }
- scaling: { per-slot-above: 4, add: { damage: 1d8 } }
```
