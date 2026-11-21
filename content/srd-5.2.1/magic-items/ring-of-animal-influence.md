# Ring of Animal Influence
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 237
*Ring, Rare*

This ring has 3 charges, and it regains 1d3 expended charges daily at dawn. While wearing the ring, you can expend 1 charge to cast one of the following spells (save DC 13) from it:

- *Animal Friendship*
- *Fear* (affects Beasts only)
- *Speak with Animals*

## Effects
```yaml
- charges: { max: 3, recharge: { dice: 1d3, at: dawn } }
- action: { cost: { charges: 1 }, cast: $srd/spells/animal-friendship, overrides: { dc: 13 } }
- action: { cost: { charges: 1 }, cast: $srd/spells/fear, overrides: { dc: 13, targets: { creature: beast } } }
- action: { cost: { charges: 1 }, cast: $srd/spells/speak-with-animals }
```
