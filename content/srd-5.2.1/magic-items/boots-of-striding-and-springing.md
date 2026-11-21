# Boots of Striding and Springing
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 214
*Wondrous Item, Uncommon (Requires Attunement)*

While you wear these boots, your Speed becomes 30 feet unless your Speed is higher, and your Speed isn’t reduced by you carrying weight in excess of your carrying capacity or wearing Heavy Armor.

Once on each of your turns, you can jump up to 30 feet by spending only 10 feet of movement.

## Effects
```yaml
- set: { to: speed:walk, value: 30 }
- trait: [speed-not-reduced-by-encumbrance-or-heavy-armor]
- trait: { text: "Once on each of your turns: jump up to 30 feet for 10 feet of movement." }
```
