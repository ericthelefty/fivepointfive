# Weapon, +1, +2, or +3
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 253
*Weapon (Any Simple or Martial), Uncommon (+1), Rare (+2), or Very Rare (+3)*

You have a bonus to attack rolls and damage rolls made with this magic weapon. The bonus is determined by the weapon’s rarity.

## Effects
```yaml
- variant: { id: plus, by: rarity, values: { uncommon: 1, rare: 2, very-rare: 3 } }
- bonus: { to: [attack, damage], value: variant:plus, scope: { weapon: { id: self } } }
```
