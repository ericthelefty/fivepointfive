# Sleet Storm
**Type:** Spell
**Source:** SRD 5.2.1, p. 163
*Level 3 Conjuration (Druid, Sorcerer, Wizard)*
**Casting Time:** Action
**Range:** 150 feet
**Components:** V, S, M (a miniature umbrella)
**Duration:** Concentration, up to 1 minute

Until the spell ends, sleet falls in a 40-foot-tall, 20-foot-radius Cylinder centered on a point you choose within range. The area is Heavily Obscured, and exposed flames in the area are doused.

Ground in the Cylinder is Difficult Terrain. When a creature enters the Cylinder for the first time on a turn or starts its turn there, it must succeed on a Dexterity saving throw or have the Prone condition and lose Concentration.

## Effects
```yaml
- zone: { area: { shape: cylinder, size: 20, height: 40 }, event: [enter-area, start-of-turn], per: turn, save: { ability: dex },
          on-failure: { apply: { condition: prone }, breaks-concentration: true }, effects: [ { trait: [heavily-obscured, difficult-terrain] } ] }
```
