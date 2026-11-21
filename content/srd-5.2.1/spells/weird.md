# Weird
**Type:** Spell
**Source:** SRD 5.2.1, p. 174
*Level 9 Illusion (Warlock, Wizard)*
**Casting Time:** Action
**Range:** 120 feet
**Components:** V, S
**Duration:** Concentration, up to 1 minute

You try to create illusory terrors in others’ minds. Each creature of your choice in a 30-foot-radius Sphere centered on a point within range makes a Wisdom saving throw. On a failed save, a target takes 10d10 Psychic damage and has the Frightened condition for the duration. On a successful save, a target takes half as much damage only.

A Frightened target makes a Wisdom saving throw at the end of each of its turns. On a failed save, it takes 5d10 Psychic damage. On a successful save, the spell ends on that target.

## Effects
```yaml
- action: { area: { shape: sphere, size: 30 }, targets: { choose: true }, save: { ability: wis, success: half }, damage: { dice: 10d10, type: psychic },
            on-failure: { apply: { condition: frightened, duration: spell } },
            then: { at: end-of-target-turn, while: frightened, save: { ability: wis }, on-failure: { damage: { dice: 5d10, type: psychic } }, on-success: { end-effect: true } } }
```
