# Ammunition, +1, +2, or +3
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 209
*Weapon (Any Ammunition), Uncommon (+1), Rare (+2), or Very Rare (+3)*

You have a bonus to attack rolls and damage rolls made with this piece of magic ammunition. The bonus is determined by the rarity of the ammunition. Once it hits a target, the ammunition is no longer magical.

This ammunition is typically found or sold in quantities of ten or twenty pieces. Ten pieces of this ammunition are equivalent in value to a potion of the same rarity.

## Effects
```yaml
- variant: { id: plus, by: rarity, values: { uncommon: 1, rare: 2, very-rare: 3 } }
- bonus: { to: [attack, damage], value: variant:plus, scope: { weapon: { id: self } } }
- trigger: { event: hit, scope: { weapon: { id: self } }, auto: true, offer: { consume: self } }
```
