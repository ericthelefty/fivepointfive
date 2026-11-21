# Trident of Fish Command
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 250
*Weapon (Trident), Uncommon (Requires Attunement)*

This magic weapon has 3 charges, and it regains 1d3 expended charges daily at dawn. While you carry it, you can expend 1 charge to cast *Dominate Beast* (save DC 15) from it on a Beast that has a Swim Speed.

## Effects
```yaml
- charges: { max: 3, recharge: { dice: 1d3, at: dawn } }
- action: { cost: { charges: 1 }, cast: $srd/spells/dominate-beast, overrides: { dc: 15, targets: { creature: beast, text: "With a Swim Speed" } } }
```
