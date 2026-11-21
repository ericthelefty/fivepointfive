# Environmental Effects
**Type:** Rule
**Source:** SRD 5.2.1, p. 195

## Deep Water

Swimming through deep water (more than 100 feet deep) presents additional challenges because of the water’s pressure and cold temperature. After each hour of swimming in deep water, a creature that lacks a Swim Speed must succeed on a DC 10 Constitution saving throw or gain 1 Exhaustion level.

## Effects
```yaml
- trigger: { event: { every: 1 hour }, when: { all: [ { player: "Swimming in deep water" }, { not: { has: { speed: swim } } } ] }, offer: { save: { ability: con, dc: 10 }, on-failure: { exhaustion: 1 } } }
```

## Extreme Cold

When the temperature is 0 degrees Fahrenheit or lower, a creature exposed to the extreme cold must succeed on a DC 10 Constitution saving throw at the end of each hour or gain 1 Exhaustion level. Creatures that have Resistance or Immunity to Cold damage automatically succeed on the save.

## Effects
```yaml
- trigger: { event: { every: 1 hour }, when: { player: "Exposed to 0°F or lower" }, offer: { save: { ability: con, dc: 10, auto-succeed: { text: "Resistance or Immunity to Cold" } }, on-failure: { exhaustion: 1 } } }
```

## Extreme Heat

When the temperature is 100 degrees Fahrenheit or higher, a creature exposed to the extreme heat and without access to drinkable water must succeed on a Constitution saving throw at the end of each hour or gain 1 Exhaustion level. The DC is 5 for the first hour and increases by 1 for each additional hour. Creatures wearing Medium or Heavy armor have Disadvantage on the save. Creatures that have Resistance or Immunity to Fire damage automatically succeed on the save.

## Effects
```yaml
- trigger: { event: { every: 1 hour }, when: { player: "Exposed to 100°F or higher without drinkable water" }, counter: { reset: { text: "Out of the heat" } },
             offer: { save: { ability: con, dc: 5 + uses, disadvantage: { when: { armor: [medium, heavy] } }, auto-succeed: { text: "Resistance or Immunity to Fire" } }, on-failure: { exhaustion: 1 } } }
```

## Frigid Water

A creature can be immersed in frigid water for a number of minutes equal to its Constitution score before suffering any ill effects. Each additional minute spent in frigid water requires the creature to succeed on a DC 10 Constitution saving throw or gain 1 Exhaustion level. Creatures with Resistance or Immunity to Cold damage automatically succeed on the save, as do creatures that are naturally adapted to living in ice-cold water.

## Effects
```yaml
- trigger: { event: { every: 1 minute }, when: { player: "Immersed longer than your Constitution score in minutes" }, offer: { save: { ability: con, dc: 10, auto-succeed: { text: "Resistance or Immunity to Cold" } }, on-failure: { exhaustion: 1 } } }
```

## Heavy Precipitation

Everything within an area of heavy rain or heavy snowfall is Lightly Obscured, and creatures in the area have Disadvantage on all Wisdom (Perception) checks. Heavy rain also extinguishes open flames.

## Effects
```yaml
- disadvantage: { roll: skill:perception, when: { player: "In heavy rain or snow" } }
```

## High Altitude

Traveling at altitudes of 10,000 feet or higher above sea level is taxing for most creatures because of the reduced amount of oxygen in the air. Each hour such a creature spends traveling at high altitude counts as 2 hours for the purpose of determining how long that creature can travel (see “Travel Pace”).

Creatures can become acclimated to a high altitude by spending 30 days or more at this elevation. Creatures can’t become acclimated to elevations above 20,000 feet unless they are native to such environments.

## Effects
```yaml
- trait: { text: "Each hour traveling above 10,000 feet counts as 2 hours of travel (until acclimated after 30 days)." }
```

## Slippery Ice

Slippery ice is Difficult Terrain. A creature that moves onto slippery ice for the first time on a turn or starts its turn there must succeed on a DC 10 Dexterity saving throw or have the Prone condition.

## Effects
```yaml
- zone: { area: { text: "The ice" }, event: [enter-area, start-of-turn], per: turn, save: { ability: dex, dc: 10 }, on-failure: { apply: { condition: prone } }, effects: [ { trait: [difficult-terrain] } ] }
```

## Strong Wind

Strong wind imposes Disadvantage on ranged attack rolls with weapons. It also extinguishes open flames and disperses fog. A flying creature in a strong wind must land at the end of its turn or fall.

A strong wind in a desert can create a sandstorm that imposes Disadvantage on Wisdom (Perception) checks.

## Effects
```yaml
- disadvantage: { roll: attack, scope: { attack: ranged-weapon }, when: { player: "In strong wind" } }
```

## Thin Ice

Thin ice has a weight tolerance of 3d10 × 10 pounds per 10-foot-square area. Whenever the total weight on an area of thin ice exceeds its tolerance, the ice in that area breaks. All creatures on broken ice fall through. Below the ice is frigid water (see “Frigid Water” above).

## Effects
```yaml
- narrative: true
```
