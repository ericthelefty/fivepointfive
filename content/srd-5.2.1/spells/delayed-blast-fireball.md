# Delayed Blast Fireball
**Type:** Spell
**Source:** SRD 5.2.1, p. 122
*Level 7 Evocation (Sorcerer, Wizard)*
**Casting Time:** Action
**Range:** 150 feet
**Components:** V, S, M (a ball of bat guano and sulfur)
**Duration:** Concentration, up to 1 minute

A beam of yellow light flashes from you, then condenses at a chosen point within range as a glowing bead for the duration. When the spell ends, the bead explodes, and each creature in a 20-foot-radius Sphere centered on that point makes a Dexterity saving throw. A creature takes Fire damage equal to the total accumulated damage on a failed save or half as much damage on a successful one.

The spell’s base damage is 12d6, and the damage increases by 1d6 whenever your turn ends and the spell hasn’t ended.

If a creature touches the glowing bead before the spell ends, that creature makes a Dexterity saving throw. On a failed save, the spell ends, causing the bead to explode. On a successful save, the creature can throw the bead up to 40 feet. If the thrown bead enters a creature’s space or collides with a solid object, the spell ends, and the bead explodes.

When the bead explodes, flammable objects in the explosion that aren’t being worn or carried start burning.

***Using a Higher-Level Spell Slot.*** The base damage increases by 1d6 for each spell slot level above 7.

## Effects
```yaml
- action: { area: { shape: sphere, size: 20 }, save: { ability: dex, success: half }, damage: { dice: 12d6, type: fire },
            grows: { at: end-of-your-turn, add: { damage: 1d6 } }, at: spell-end,
            text: "A creature touching the bead saves (Dex): fail = explodes, success = throw it 40 feet." }
- scaling: { per-slot-above: 7, add: { damage: 1d6 } }
```
