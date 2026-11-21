# Falling [Hazard]
**Type:** Rule
**Source:** SRD 5.2.1, p. 182

A creature that falls takes 1d6 Bludgeoning damage at the end of the fall for every 10 feet it fell, to a maximum of 20d6. When the creature lands, it has the Prone condition unless it avoids taking any damage from the fall.

A creature that falls into water or another liquid can use its Reaction to make a DC 15 Strength (Athletics) or Dexterity (Acrobatics) check to hit the surface head or feet first. On a successful check, any damage resulting from the fall is halved.

## Effects
```yaml
- trigger: { event: fall, auto: true, offer: { damage: { dice: "dice(min(20, fall.feet / 10), d6)", type: bludgeoning }, apply: { condition: prone, if: "Took damage" } } }
- trigger: { event: fall, reaction: true, if: "Falling into water or another liquid",
             offer: { check: { skill: { choose: [athletics, acrobatics] }, dc: 15 }, on-success: { damage-taken: half } } }
```
