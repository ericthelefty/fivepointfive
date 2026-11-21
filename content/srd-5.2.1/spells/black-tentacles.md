# Black Tentacles
**Type:** Spell
**Source:** SRD 5.2.1, p. 113
*Level 4 Conjuration (Wizard)*
**Casting Time:** Action
**Range:** 90 feet
**Components:** V, S, M (a tentacle)
**Duration:** Concentration, up to 1 minute

Squirming, ebony tentacles fill a 20-foot square on ground that you can see within range. For the duration, these tentacles turn the ground in that area into Difficult Terrain.

Each creature in that area makes a Strength saving throw. On a failed save, it takes 3d6 Bludgeoning damage, and it has the Restrained condition until the spell ends. A creature also makes that save if it enters the area or ends it turn there. A creature makes that save only once per turn.

A Restrained creature can take an action to make a Strength (Athletics) check against your spell save DC, ending the condition on itself on a success.

## Effects
```yaml
- zone: { area: { shape: square, size: 20 }, event: [cast, enter-area, end-of-turn], per: turn, save: { ability: str },
          damage: { dice: 3d6, type: bludgeoning }, apply: { condition: restrained, duration: spell, escape: { check: skill:athletics, dc: spell:dc } },
          effects: [ { trait: [difficult-terrain] } ] }
```
