# Luck Blade
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 229
*Weapon (Glaive, Greatsword, Longsword, Rapier, Scimitar, Sickle, or Shortsword), Legendary (Requires Attunement)*

You gain a +1 bonus to attack rolls and damage rolls made with this magic weapon. While the weapon is on your person, you also gain a +1 bonus to saving throws.

***Luck.*** If the weapon is on your person, you can call on its luck (no action required) to reroll one failed D20 Test if you don’t have the Incapacitated condition. You must use the second roll. Once used, this property can’t be used again until the next dawn.

***Wish.*** The weapon has 1d3 charges. While holding it, you can expend 1 charge and cast *Wish* from it. Once used, this property can’t be used again until the next dawn. The weapon loses this property if it has no charges.

## Effects
```yaml
- bonus: { to: [attack, damage], value: 1, scope: { weapon: { id: self } } }
- bonus: { to: save:all, value: 1, when: { has: { item: self } } }
- resource: { id: luck, max: 1, reset: dawn }
- trigger: { event: { fail: d20 }, when: { not: { condition: incapacitated } }, offer: { reroll: true, must-use-new: true, cost: { resource: $#luck } } }
- charges: { max: 1d3, start: 1d3 }
- resource: { id: luck-wish, max: 1, reset: dawn }
- action: { cost: { charges: 1, resource: $#luck-wish }, cast: $srd/spells/wish }
```
