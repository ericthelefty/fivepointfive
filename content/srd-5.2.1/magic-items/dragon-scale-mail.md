# Dragon Scale Mail
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 218

*Armor (Scale Mail), Very Rare (Requires Attunement) Dragon Scale Mail* is made of the scales of one kind of dragon. Sometimes dragons collect their cast-off scales and gift them. Other times, hunters carefully preserve the hide of a dead dragon. In either case, *Dragon Scale Mail* is highly valued.

While wearing this armor, you gain a +1 bonus to Armor Class, you have Advantage on saving throws against the breath weapons of Dragons, and you have Resistance to one damage type determined by the kind of dragon that provided the scales (see the accompanying table).

Additionally, you can focus your senses as a Magic action to discern the distance and direction to the closest dragon within 30 miles of yourself that is of the same type as the armor. This action can’t be used again until the next dawn.

|  |  |  |  |
|---|---|---|---|
| Dragon | Resistance | Dragon | Resistance |
| Black | Acid | Gold | Fire |
| Blue | Lightning | Green | Poison |
| Brass | Fire | Red | Fire |
| Bronze | Lightning | Silver | Cold |
| Copper | Acid | White | Cold |

## Effects
```yaml
- variant: { id: dragon, by: name, table: Dragon Scale Mail }
- bonus: { to: ac, value: 1 }
- advantage: { roll: save:all, scope: { source: dragon-breath } }
- defense: { resistance: [variant:dragon.damage] }
- resource: { id: dragon-sense, max: 1, reset: dawn }
- action: { activation: magic, cost: { resource: $#dragon-sense }, text: "Learn the distance and direction to the nearest dragon of that kind within 30 miles." }
```
