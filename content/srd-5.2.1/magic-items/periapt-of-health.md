# Periapt of Health
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 234
*Wondrous Item, Uncommon (Requires Attunement)*

While wearing this pendant, you can take a Magic action to regain 2d4 + 2 Hit Points. Once used, this property can’t be used again until the next dawn.

In addition, you have Advantage on saving throws to avoid or end the Poisoned condition while you wear this pendant.

## Effects
```yaml
- resource: { id: periapt, max: 1, reset: dawn }
- action: { activation: magic, cost: { resource: $#periapt }, heal: 2d4 + 2 }
- advantage: { roll: save:all, scope: { against: { condition: poisoned } } }
```
