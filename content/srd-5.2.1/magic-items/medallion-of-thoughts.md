# Medallion of Thoughts
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 230
*Wondrous Item, Uncommon (Requires Attunement)*

The medallion has 5 charges. While wearing it, you can expend 1 charge to cast *Detect Thoughts* (save DC 13) from it. The medallion regains 1d4 expended charges daily at dawn.

## Effects
```yaml
- charges: { max: 5, recharge: { dice: 1d4, at: dawn } }
- action: { cost: { charges: 1 }, cast: $srd/spells/detect-thoughts, overrides: { dc: 13 } }
```
