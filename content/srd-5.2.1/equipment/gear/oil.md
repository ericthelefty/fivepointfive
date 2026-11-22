# Oil
**Type:** Gear
**Cost:** 1 SP
**Weight:** 1 lb.
**Source:** SRD 5.2.1, p. 98

You can douse a creature, object, or space with Oil or use it as fuel, as detailed below.

***Dousing a Creature or an Object.*** When you take the Attack action, you can replace one of your attacks with throwing an Oil flask. Target one creature or object within 20 feet of yourself. The target must succeed on a Dexterity saving throw (DC 8 plus your Dexterity modifier and Proficiency Bonus) or be covered in oil. If the target takes Fire damage before the oil dries (after 1 minute), the target takes an extra 5 Fire damage from burning oil.

***Dousing a Space.*** You can take the Utilize action to pour an Oil flask on level ground to cover a 5-foot-square area within 5 feet of yourself. If lit, the oil burns until the end of the turn 2 rounds from when the oil was lit (or 12 seconds) and deals 5 Fire damage to any creature that enters the area or ends its turn there. A creature can take this damage only once per turn.

***Fuel.*** Oil serves as fuel for Lamps and Lanterns. Once lit, a flask of Oil burns for 6 hours in a Lamp or Lantern. That duration doesn’t need to be consecutive; you can extinguish the burning Oil (as a Utilize action) and rekindle it again until it has burned for a total of 6 hours.

## Effects
```yaml
- action:
    choose-one:
      - { id: douse-creature, label: Douse a creature, activation: replace-attack, range: 20, save: { ability: dex, dc: 8 + mod:dex + prof },
          on-failure: { apply: { duration: { amount: 1, unit: minute }, text: "Covered in oil: +5 Fire damage the next time it takes Fire damage" } } }
      - { id: douse-space, label: Douse a space, activation: utilize, zone: { area: { shape: square, size: 5 }, event: [enter-area, end-of-turn], damage: { dice: 5, type: fire }, text: "Burns 2 rounds if lit." } }
      - { id: fuel, label: Fuel, text: "Fuels a lamp or lantern for 6 hours." }
    consume: true
```
