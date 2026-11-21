# Vicious Weapon
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 250
*Weapon (Any Simple or Martial), Rare*

This magic weapon deals an extra 2d6 damage to any creature it hits. This extra damage is of the same type as the weapon’s normal damage.

## Effects
```yaml
- trigger: { event: hit, scope: { weapon: { id: self } }, auto: true, offer: { damage: { dice: 2d6, type: weapon } } }
```
