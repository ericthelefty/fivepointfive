# Dehydration [Hazard]
**Type:** Rule
**Source:** SRD 5.2.1, p. 181

A creature requires an amount of water per day based on its size, as shown in the Water Needs per Day table. A creature that drinks less than half the required water for a day gains 1 Exhaustion level at the day’s end. Exhaustion caused by dehydration can’t be removed until the creature drinks the full amount of water required for a day. *See also* “Exhaustion.”

## Effects
```yaml
- trigger: { event: { every: 1 day }, when: { player: "Drank less than half the water needed" }, offer: { exhaustion: 1 } }
```

## Water Needs per Day

| Size | Water | Size | Water |
|---|---|---|---|
| Tiny | 1/4 gallon | Large | 4 gallons |
| Small | 1 gallon | Huge | 16 gallons |
| Medium | 1 gallon | Gargantuan | 64 gallons |
