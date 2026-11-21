# Potions of Healing
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 236
*Potion, Rarity Varies*

You regain Hit Points when you drink this potion. The number of Hit Points depends on the potion’s rarity, as shown in the table below.

Whatever its potency, the potion’s red liquid glimmers when agitated.

|  |  |  |
|---|---|---|
| Potion | HP Regained | Rarity |
| Potion of Healing | 2d4 + 2 | Common |
| Potion of Healing (greater) | 4d4 + 4 | Uncommon |
| Potion of Healing (superior) | 8d4 + 8 | Rare |
| Potion of Healing (supreme) | 10d4 + 20 | Very Rare |

## Effects
```yaml
- variant: { id: heal, by: name, values: { "": 2d4+2, greater: 4d4+4, superior: 8d4+8, supreme: 10d4+20 } }
- action: { activation: bonus, heal: variant:heal, consume: true }
```
