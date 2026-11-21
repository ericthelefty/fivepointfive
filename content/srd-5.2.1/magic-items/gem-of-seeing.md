# Gem of Seeing
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 223
*Wondrous Item, Rare (Requires Attunement)*

This gem has 3 charges. As a Magic action, you can expend 1 charge. For the next 10 minutes, you have Truesight out to 120 feet when you peer through the gem.

The gem regains 1d3 expended charges daily at dawn.

## Effects
```yaml
- charges: { max: 3, recharge: { dice: 1d3, at: dawn } }
- toggle: { activation: magic, cost: { charges: 1 }, duration: { amount: 10, unit: minute }, effects: [ { sense: { truesight: 120 } } ] }
```
