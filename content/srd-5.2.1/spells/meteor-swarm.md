# Meteor Swarm
**Type:** Spell
**Source:** SRD 5.2.1, p. 149
*Level 9 Evocation (Sorcerer, Wizard)*
**Casting Time:** Action
**Range:** 1 mile
**Components:** V, S
**Duration:** Instantaneous

Blazing orbs of fire plummet to the ground at four different points you can see within range. Each creature in a 40-foot-radius Sphere centered on each of those points makes a Dexterity saving throw. A creature takes 20d6 Fire damage and 20d6 Bludgeoning damage on a failed save or half as much damage on a successful one. A creature in the area of more than one fiery Sphere is affected only once.

A nonmagical object that isn’t being worn or carried also takes the damage if it’s in the spell’s area, and the object starts burning if it’s flammable.

## Effects
```yaml
- action: { area: { shape: sphere, size: 40, count: 4 }, save: { ability: dex, success: half },
            damage: [ { dice: 20d6, type: fire }, { dice: 20d6, type: bludgeoning } ], text: "A creature in several spheres is affected once." }
```
