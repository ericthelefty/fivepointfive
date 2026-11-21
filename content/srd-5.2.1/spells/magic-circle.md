# Magic Circle
**Type:** Spell
**Source:** SRD 5.2.1, p. 145
*Level 3 Abjuration (Cleric, Paladin, Warlock, Wizard)*
**Casting Time:** 1 minute
**Range:** 10 feet
**Components:** V, S, M (salt and powdered silver worth 100+ GP, which the spell consumes)
**Duration:** 1 hour

You create a 10-foot-radius, 20-foot-tall Cylinder of magical energy centered on a point on the ground that you can see within range. Glowing runes appear wherever the Cylinder intersects with the floor or other surface.

Choose one or more of the following types of creatures: Celestials, Elementals, Fey, Fiends, or Undead. The circle affects a creature of the chosen type in the following ways:

- The creature can’t willingly enter the Cylinder by nonmagical means. If the creature tries to use teleportation or interplanar travel to do so, it must first succeed on a Charisma saving throw.
- The creature has Disadvantage on attack rolls against targets within the Cylinder.
- Targets within the Cylinder can’t be possessed by or gain the Charmed or Frightened condition from the creature.

Each time you cast this spell, you can cause its magic to operate in the reverse direction, preventing a creature of the specified type from leaving the Cylinder and protecting targets outside it.

***Using a Higher-Level Spell Slot.*** The duration increases by 1 hour for each spell slot level above 3.

## Effects
```yaml
- zone: { area: { shape: cylinder, size: 10, height: 20 },
          choose: { id: circle-types, kind: option, count: any, options: [ { id: celestial }, { id: elemental }, { id: fey }, { id: fiend }, { id: undead } ] },
          choose-one: [ { id: inward, label: Keep them out }, { id: outward, label: Keep them in } ],
          text: "Chosen creatures can't willingly enter by nonmagical means (Cha save to teleport in), have Disadvantage on attacks against targets inside, and can't charm, frighten or possess them." }
- scaling: { per-slot-above: 3, add: { duration: 1 hour } }
```
