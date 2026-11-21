# Potion of Giant Strength
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 235
*Potion, Rarity Varies*

When you drink this potion, your Strength score changes for 1 hour. The type of giant determines the score (see the table below). The potion has no effect on you if your Strength is equal to or greater than that score.

This potion’s transparent liquid has floating in it a sliver of light resembling a giant’s fingernail.

|  |  |  |
|---|---|---|
| Potion | Str. | Rarity |
| Potion of Giant Strength (hill) | 21 | Uncommon |
| Potion of Giant Strength (frost or stone) | 23 | Rare |
| Potion of Giant Strength (fire) | 25 | Rare |
| Potion of Giant Strength (cloud) | 27 | Very Rare |
| Potion of Giant Strength (storm) | 29 | Legendary |

## Effects
```yaml
- variant: { id: str, by: name, values: { hill: 21, frost: 23, stone: 23, fire: 25, cloud: 27, storm: 29 } }
- action:
    activation: bonus
    consume: true
    duration: { amount: 1, unit: hour }
    effects:
      - set: { to: score:str, value: variant:str }
```
