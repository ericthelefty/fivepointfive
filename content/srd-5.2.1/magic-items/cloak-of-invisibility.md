# Cloak of Invisibility
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 215
*Wondrous Item, Legendary (Requires Attunement)*

This cloak has 3 charges and regains 1d3 expended charges daily at dawn. While wearing the cloak, you can take a Magic action to pull its hood over your head and expend 1 charge to give yourself the Invisible condition for 1 hour. The effect ends early if you pull the hood down (no action required) or cease wearing the cloak.

## Effects
```yaml
- charges: { max: 3, recharge: { dice: 1d3, at: dawn } }
- toggle: { activation: magic, cost: { charges: 1 }, duration: { amount: 1, unit: hour }, effects: [ { condition: [invisible] } ] }
```
