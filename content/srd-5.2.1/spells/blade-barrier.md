# Blade Barrier
**Type:** Spell
**Source:** SRD 5.2.1, p. 113
*Level 6 Evocation (Cleric)*
**Casting Time:** Action
**Range:** 90 feet
**Components:** V, S
**Duration:** Concentration, up to 10 minutes

You create a wall of whirling blades made of magical energy. The wall appears within range and lasts for the duration. You make a straight wall up to 100 feet long, 20 feet high, and 5 feet thick, or a ringed wall up to 60 feet in diameter, 20 feet high, and 5 feet thick. The wall provides Three-Quarters Cover, and its space is Difficult Terrain.

Any creature in the wall’s space makes a Dexterity saving throw, taking 6d10 Force damage on a failed save or half as much damage on a successful one. A creature also makes that save if it enters the wall’s space or ends it turn there. A creature makes that save only once per turn.

## Effects
```yaml
- zone: { area: { choose-on-use: [ { shape: wall, size: 100, height: 20, width: 5 }, { shape: ring, size: 60, height: 20, width: 5 } ] },
          event: [cast, enter-area, end-of-turn], per: turn, save: { ability: dex, success: half }, damage: { dice: 6d10, type: force },
          effects: [ { trait: [three-quarters-cover, difficult-terrain] } ] }
```
