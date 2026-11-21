# Dragonborn
**Type:** Species
**Source:** SRD 5.2.1, p. 84
**Creature Type:** Humanoid
**Size:** Medium (about 5–7 feet tall)
**Speed:** 30 feet

As a Dragonborn, you have these special traits.

## Draconic Ancestry

Your lineage stems from a dragon progenitor. Choose the kind of dragon from the Draconic Ancestors table. Your choice affects your Breath Weapon and Damage Resistance traits as well as your appearance.

## Effects
```yaml
- choose:
    id: ancestry
    kind: option
    options:
      - { id: black,  label: Black,  damage: acid }
      - { id: blue,   label: Blue,   damage: lightning }
      - { id: brass,  label: Brass,  damage: fire }
      - { id: bronze, label: Bronze, damage: lightning }
      - { id: copper, label: Copper, damage: acid }
      - { id: gold,   label: Gold,   damage: fire }
      - { id: green,  label: Green,  damage: poison }
      - { id: red,    label: Red,    damage: fire }
      - { id: silver, label: Silver, damage: cold }
      - { id: white,  label: White,  damage: cold }
```

## Draconic Ancestors

| Dragon | Damage Type | Dragon | Damage Type |
|---|---|---|---|
| Black | Acid | Gold | Fire |
| Blue | Lightning | Green | Poison |
| Brass | Fire | Red | Fire |
| Bronze | Lightning | Silver | Cold |
| Copper | Acid | White | Cold |

## Breath Weapon

When you take the Attack action on your turn, you can replace one of your attacks with an exhalation of magical energy in either a 15-foot Cone or a 30-foot Line that is 5 feet wide (choose the shape each time). Each creature in that area must make a Dexterity saving throw (DC 8 plus your Constitution modifier and Proficiency Bonus). On a failed save, a creature takes 1d10 damage of the type determined by your Draconic Ancestry trait. On a successful save, a creature takes half as much damage. This damage increases by 1d10 when you reach character levels 5 (2d10), 11 (3d10), and 17 (4d10).

You can use this Breath Weapon a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest.

## Effects
```yaml
- resource: { id: breath, max: prof, reset: long }
- action:
    id: breath-weapon
    activation: replace-attack
    cost: { resource: $#breath }
    area: { choose-on-use: [ { shape: cone, size: 15 }, { shape: line, size: 30, width: 5 } ] }
    save: { ability: dex, dc: 8 + mod:con + prof, success: half }
    damage: { dice: { steps: { 1: 1d10, 5: 2d10, 11: 3d10, 17: 4d10 }, by: level }, type: choice:ancestry.damage }
```

## Damage Resistance

You have Resistance to the damage type determined by your Draconic Ancestry trait.

## Effects
```yaml
- defense: { resistance: [choice:ancestry.damage] }
```

## Darkvision

You have Darkvision with a range of 60 feet.

## Effects
```yaml
- sense: { darkvision: 60 }
```

## Draconic Flight

When you reach character level 5, you can channel draconic magic to give yourself temporary flight. As a Bonus Action, you sprout spectral wings on your back that last for 10 minutes or until you retract the wings (no action required) or have the Incapacitated condition. During that time, you have a Fly Speed equal to your Speed. Your wings appear to be made of the same energy as your Breath Weapon. Once you use this trait, you can’t use it again until you finish a Long Rest.

## Effects
```yaml
- resource: { id: flight, max: 1, reset: long }
- toggle:
    id: draconic-flight
    level: 5
    activation: bonus
    cost: { resource: $#flight }
    duration: { amount: 10, unit: minute }
    ends-when: [{ condition: incapacitated }]
    effects:
      - speed: { fly: speed:walk }
```
