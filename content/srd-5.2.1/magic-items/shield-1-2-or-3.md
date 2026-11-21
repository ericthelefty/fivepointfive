# Shield, +1, +2, or +3
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 243
*Armor (Shield), Uncommon (+1), Rare (+2), or Very Rare (+3)*

While holding this Shield, you have a bonus to Armor Class determined by the Shield’s rarity, in addition to the Shield’s normal bonus to AC.

## Effects
```yaml
- variant: { id: plus, by: rarity, values: { uncommon: 1, rare: 2, very-rare: 3 } }
- bonus: { to: ac, value: variant:plus, when: { equipped: self } }
```
