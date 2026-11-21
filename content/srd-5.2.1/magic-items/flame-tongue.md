# Flame Tongue
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 223
*Weapon (Any Melee Weapon), Rare (Requires Attunement)*

While holding this magic weapon, you can take a Bonus Action and use a command word to cause flames to engulf the damage-dealing part of the weapon. These flames shed Bright Light in a 40-foot radius and Dim Light for an additional 40 feet. While the weapon is ablaze, it deals an extra 2d6 Fire damage on a hit. The flames last until you take a Bonus Action to issue the command again or until you drop, stow, or sheathe the weapon.

## Effects
```yaml
- toggle:
    activation: bonus
    ends-when: [{ text: "You drop, stow or sheathe the weapon" }]
    effects:
      - trigger: { event: hit, scope: { weapon: { id: self } }, auto: true, offer: { damage: { dice: 2d6, type: fire } } }
      - trait: { light: { bright: 40, dim: 40 } }
```
