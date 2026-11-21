# Chromatic Orb
**Type:** Spell
**Source:** SRD 5.2.1, p. 115
*Level 1 Evocation (Sorcerer, Wizard)*
**Casting Time:** Action
**Range:** 90 feet
**Components:** V, S, M (a diamond worth 50+ GP)
**Duration:** Instantaneous

You hurl an orb of energy at a target within range. Choose Acid, Cold, Fire, Lightning, Poison, or Thunder for the type of orb you create, and then make a ranged spell attack against the target. On a hit, the target takes 3d8 damage of the chosen type.

If you roll the same number on two or more of the d8s, the orb leaps to a different target of your choice within 30 feet of the target. Make an attack roll against the new target, and make a new damage roll. The orb can’t leap again unless you cast the spell with a level 2+ spell slot.

***Using a Higher-Level Spell Slot.*** The damage increases by 1d8 for each spell slot level above 1. The orb can leap a maximum number of times equal to the level of the slot expended, and a creature can be targeted only once by each casting of this spell.

## Effects
```yaml
- action: { attack: { kind: ranged-spell }, damage: { dice: 3d8, type: { choose-on-use: [acid, cold, fire, lightning, poison, thunder] } },
            then: { if: "Two or more d8s show the same number", text: "The orb leaps to another target within 30 feet: new attack and damage roll (max leaps = slot level − 1)." } }
- scaling: { per-slot-above: 1, add: { damage: 1d8 } }
```
