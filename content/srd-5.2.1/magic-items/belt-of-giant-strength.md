# Belt of Giant Strength
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 213
*Wondrous Item, Rarity Varies (Requires Attunement)*

While wearing this belt, your Strength changes to a score granted by the belt. The type of giant determines the score (see the table below). The item has no effect on you if your Strength without the belt is equal to or greater than the belt’s score.

| Belt | Str. | Rarity |
|---|---|---|
| Belt of Giant Strength (hill) | 21 | Rare |
| Belt of Giant Strength (frost or stone) | 23 | Very Rare |
| Belt of Giant Strength (fire) | 25 | Very Rare |
| Belt of Giant Strength (cloud) | 27 | Legendary |
| Belt of Giant Strength (storm) | 29 | Legendary |

## Effects
```yaml
- variant: { id: str, by: name, values: { hill: 21, frost: 23, stone: 23, fire: 25, cloud: 27, storm: 29 } }
- set: { to: score:str, value: variant:str }                      # set = only if higher (matches the text)
```
