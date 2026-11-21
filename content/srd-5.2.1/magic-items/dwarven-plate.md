# Dwarven Plate
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 219
*Armor (Half Plate Armor or Plate Armor), Very Rare*

While wearing this armor, you gain a +2 bonus to Armor Class. In addition, if an effect moves you against your will along the ground, you can take a Reaction to reduce the distance you are moved by up to 10 feet.

## Effects
```yaml
- bonus: { to: ac, value: 2 }
- trigger: { event: forced-move, reaction: true, offer: { text: "Reduce the distance by up to 10 feet." } }
```
