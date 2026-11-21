# Rod of Resurrection
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 242
*Rod, Legendary (Requires Attunement)*

The rod has 5 charges. While you hold it, you can cast one of the following spells from it: *Heal* (expends 1 charge) or *Resurrection* (expends 5 charges).

The rod regains 1 expended charge daily at dawn. If you expend the last charge, roll 1d20. On a 1, the rod disappears in a harmless burst of radiance.

## Effects
```yaml
- charges: { max: 5, recharge: { dice: 1, at: dawn }, destroy-on: { roll: 1d20, if: 1, when: last-charge } }
- cast-list: { pay-from: charges, spells: [ { spell: $srd/spells/heal, cost: 1 }, { spell: $srd/spells/resurrection, cost: 5 } ] }
```
