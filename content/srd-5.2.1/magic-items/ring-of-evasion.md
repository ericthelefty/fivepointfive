# Ring of Evasion
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 238
*Ring, Rare (Requires Attunement)*

This ring has 3 charges, and it regains 1d3 expended charges daily at dawn. When you fail a Dexterity saving throw while wearing the ring, you can take a Reaction to expend 1 charge to succeed on that save instead.

## Effects
```yaml
- charges: { max: 3, recharge: { dice: 1d3, at: dawn } }
- trigger: { event: { fail: save }, scope: { ability: dex }, reaction: true, offer: { treat-as: success, cost: { charges: 1 } } }
```
