# Conjure Celestial
**Type:** Spell
**Source:** SRD 5.2.1, p. 118
*Level 7 Conjuration (Cleric)*
**Casting Time:** Action
**Range:** 90 feet
**Components:** V, S
**Duration:** Concentration, up to 10 minutes

You conjure a spirit from the Upper Planes, which manifests as a pillar of light in a 10-foot-radius, 40-foot-high Cylinder centered on a point within range. For each creature you can see in the Cylinder, choose which of these lights shines on it:

**Healing Light.** The target regains Hit Points equal to 4d12 plus your spellcasting ability modifier.

**Searing Light.** The target makes a Dexterity saving throw, taking 6d12 Radiant damage on a failed save or half as much damage on a successful one. Until the spell ends, Bright Light fills the Cylinder, and when you move on your turn, you can also move the Cylinder up to 30 feet.

Whenever the Cylinder moves into the space of a creature you can see and whenever a creature you can see enters the Cylinder or ends its turn there, you can bathe it in one of the lights. A creature can be affected by this spell only once per turn.

***Using a Higher-Level Spell Slot.*** The healing and damage increase by 1d12 for each spell slot level above 7.

## Effects
```yaml
- zone: { area: { shape: cylinder, size: 10, height: 40 }, event: [cast, enter-area, end-of-turn], per: turn, moves: { with: you, distance: 30 },
          choose-one: [ { id: healing, label: Healing Light, heal: 4d12 + spell-ability },
                        { id: searing, label: Searing Light, save: { ability: dex, success: half }, damage: { dice: 6d12, type: radiant } } ],
          effects: [ { trait: { light: { bright: fill } } } ] }
- scaling: { per-slot-above: 7, add: { choose-one.healing.heal: 1d12, choose-one.searing.damage: 1d12 } }
```
