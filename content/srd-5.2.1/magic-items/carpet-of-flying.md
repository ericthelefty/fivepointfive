# Carpet of Flying
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 215
*Wondrous Item, Very Rare*

You can make this carpet hover and fly by taking a Magic action and using the carpet’s command word. It moves according to your directions if you are within 30 feet of it.

Four sizes of *Carpet of Flying* exist. The GM chooses the size of a given carpet or determines it randomly by rolling on the following table. A carpet can carry up to twice the weight shown on the table, but its Fly Speed is halved if it carries more than its normal capacity.

|  |  |  |  |
|---|---|---|---|
| 1d100 | Size | Capacity | Fly Speed |
| 01–20 | 3 ft. × 5 ft. | 200 lb. | 80 feet |
| 21–55 | 4 ft. × 6 ft. | 400 lb. | 60 feet |
| 56–80 | 5 ft. × 7 ft. | 600 lb. | 40 feet |
| 81–00 | 6 ft. × 9 ft. | 800 lb. | 30 feet |

## Effects
```yaml
- variant: { id: size, by: roll, roll: 1d100, table: Carpet of Flying, values: { 3x5: { capacity: 200, fly: 80 }, 4x6: { capacity: 400, fly: 60 }, 5x7: { capacity: 600, fly: 40 }, 6x9: { capacity: 800, fly: 30 } } }
- toggle: { activation: magic, effects: [ { speed: { fly: variant:size.fly } } ], text: "Fly Speed halves above its capacity (max twice capacity)." }
```
