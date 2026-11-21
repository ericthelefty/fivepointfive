# Helm of Teleportation
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 226
*Wondrous Item, Rare (Requires Attunement)*

This helm has 3 charges. While wearing it, you can expend 1 charge to cast *Teleport* from it. The helm regains 1d3 expended charges daily at dawn.

## Effects
```yaml
- charges: { max: 3, recharge: { dice: 1d3, at: dawn } }
- action: { cost: { charges: 1 }, cast: $srd/spells/teleport }
```
