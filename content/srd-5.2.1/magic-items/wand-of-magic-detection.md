# Wand of Magic Detection
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 251
*Wand, Uncommon*

This wand has 3 charges. While holding it, you can expend 1 charge to cast *Detect Magic* from it. The wand regains 1d3 expended charges daily at dawn.

## Effects
```yaml
- charges: { max: 3, recharge: { dice: 1d3, at: dawn } }
- action: { cost: { charges: 1 }, cast: $srd/spells/detect-magic }
```
