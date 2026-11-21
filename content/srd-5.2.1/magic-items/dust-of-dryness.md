# Dust of Dryness
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 219
*Wondrous Item, Uncommon*

This small packet contains 1d6 + 4 pinches of dust. As a Utilize action, you can sprinkle a pinch of the dust over water, turning up to a 15-foot Cube of water into one marble-sized pellet, which floats or rests near where the dust was sprinkled. The pellet’s weight is negligible. A creature can take a Utilize action to smash the pellet against a hard surface, causing the pellet to shatter and release the water the dust absorbed. Doing so destroys the pellet and ends its magic.

As a Utilize action, you can sprinkle a pinch of the dust on an Elemental within 5 feet of yourself that is composed mostly of water (such as a **Water Elemental**). Such a creature exposed to a pinch of the dust makes a DC 13 Constitution saving throw, taking 10d6 Necrotic damage on a failed save or half as much damage on a successful one.

## Effects
```yaml
- charges: { max: 1d6 + 4, start: 1d6 + 4 }
- action: { activation: utilize, cost: { charges: 1 }, choose-one: [
              { id: water, label: Absorb water, text: "Turns a 15-foot Cube of water into a pellet." },
              { id: elemental, label: Water Elemental, save: { ability: con, dc: 13 }, damage: { dice: 10d6, type: necrotic, success: half } } ] }
```
