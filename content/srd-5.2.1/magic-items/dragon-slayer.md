# Dragon Slayer
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 219
*Weapon (Any Simple or Martial), Rare*

You gain a +1 bonus to attack rolls and damage rolls made with this magic weapon.

The weapon deals an extra 3d6 damage of the weapon’s type if the target is a Dragon.

## Effects
```yaml
- bonus: { to: [attack, damage], value: 1, scope: { weapon: { id: self } } }
- trigger: { event: hit, scope: { weapon: { id: self }, against: { creature: dragon } }, auto: true,
             offer: { damage: { dice: 3d6, type: weapon } } }
```
