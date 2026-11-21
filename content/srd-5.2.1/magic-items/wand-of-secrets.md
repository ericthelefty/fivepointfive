# Wand of Secrets
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 251
*Wand, Uncommon*

This wand has 3 charges and regains 1d3 expended charges daily at dawn. While holding it, you can take a Magic action to expend 1 charge, and if a secret door or trap is within 60 feet of you, the wand pulses and points at the one nearest to you.

## Effects
```yaml
- charges: { max: 3, recharge: { dice: 1d3, at: dawn } }
- action: { activation: magic, cost: { charges: 1 }, text: "Points at the nearest secret door or trap within 60 feet." }
```
