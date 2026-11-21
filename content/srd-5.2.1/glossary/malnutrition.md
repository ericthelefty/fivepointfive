# Malnutrition [Hazard]
**Type:** Rule
**Source:** SRD 5.2.1, p. 185

A creature needs an amount of food per day based on its size, as shown in the Food Needs per Day table. A creature that eats but consumes less than half the required food for a day must succeed on a DC 10 Constitution saving throw or gain 1 Exhaustion level at the day’s end. A creature that eats nothing for 5 days automatically gains 1 Exhaustion level at the end of the fifth day as well as an additional level at the end of each subsequent day without food.

Exhaustion caused by malnutrition can’t be removed until the creature eats the full amount of food required for a day. *See also* “Exhaustion.”

## Effects
```yaml
- trigger: { event: { every: 1 day }, when: { player: "Ate less than half the food needed" }, offer: { save: { ability: con, dc: 10 }, on-failure: { exhaustion: 1 } } }
```

## Food Needs per Day

| Size | Food | Size | Food |
|---|---|---|---|
| Tiny | 1/4 pound | Large | 4 pounds |
| Small | 1 pound | Huge | 16 pounds |
| Medium | 1 pound | Gargantuan | 64 pounds |
