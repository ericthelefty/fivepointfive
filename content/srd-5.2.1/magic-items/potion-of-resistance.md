# Potion of Resistance
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 236
*Potion, Uncommon*

When you drink this potion, you have Resistance to one type of damage for 1 hour. The GM chooses the type or determines it randomly by rolling on the following table.

|  |  |  |  |
|---|---|---|---|
| 1d10 | Damage Type | 1d10 | Damage Type |
| 1 | Acid | 6 | Necrotic |
| 2 | Cold | 7 | Poison |
| 3 | Fire | 8 | Psychic |
| 4 | Force | 9 | Radiant |
| 5 | Lightning | 10 | Thunder |

## Effects
```yaml
- variant: { id: type, by: roll, roll: 1d10, values: { 1: acid, 2: cold, 3: fire, 4: force, 5: lightning, 6: necrotic, 7: poison, 8: psychic, 9: radiant, 10: thunder } }
- action: { activation: bonus, consume: true, duration: { amount: 1, unit: hour }, effects: [ { defense: { resistance: [variant:type] } } ] }
```
