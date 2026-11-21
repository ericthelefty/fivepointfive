# Armor of Resistance
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 210
*Armor (Any Light, Medium, or Heavy), Rare (Requires Attunement)*

You have Resistance to one type of damage while you wear this armor. The GM chooses the type or determines it randomly by rolling on the following table.

|  |  |  |  |
|---|---|---|---|
| 1d10 1 | Damage Type Acid | 1d10 6 | Damage Type Necrotic |
| 2 | Cold | 7 | Poison |
| 3 | Fire | 8 | Psychic |
| 4 5 | Force Lightning | 9 10 | Radiant Thunder |

## Effects
```yaml
- variant: { id: type, by: roll, roll: 1d10, values: { 1: acid, 2: cold, 3: fire, 4: force, 5: lightning, 6: necrotic, 7: poison, 8: psychic, 9: radiant, 10: thunder } }
- defense: { resistance: [variant:type] }
```
