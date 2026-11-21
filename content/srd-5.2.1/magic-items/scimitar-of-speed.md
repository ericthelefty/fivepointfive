# Scimitar of Speed
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 243
*Weapon (Scimitar), Very Rare (Requires Attunement)*

You gain a +2 bonus to attack rolls and damage rolls made with this magic weapon. In addition, you can make one attack with it as a Bonus Action on each of your turns.

## Effects
```yaml
- bonus: { to: [attack, damage], value: 2, scope: { weapon: { id: self } } }
- action: { activation: bonus, per: turn, attack: { weapon: self } }
```
