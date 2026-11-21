# Giant Slayer
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 223
*Weapon (Any Simple or Martial), Rare*

You gain a +1 bonus to attack rolls and damage rolls made with this magic weapon.

When you hit a Giant with this weapon, the Giant takes an extra 2d6 damage of the weapon’s type and must succeed on a DC 15 Strength saving throw or have the Prone condition.

## Effects
```yaml
- bonus: { to: [attack, damage], value: 1, scope: { weapon: { id: self } } }
- trigger: { event: hit, scope: { weapon: { id: self }, against: { creature: giant } }, auto: true,
             offer: { damage: { dice: 2d6, type: weapon }, save: { ability: str, dc: 15 }, on-failure: { apply: { condition: prone } } } }
```
