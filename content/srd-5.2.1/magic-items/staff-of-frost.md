# Staff of Frost
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 245
*Staff, Very Rare (Requires Attunement by a Druid, Sorcerer, Warlock, or Wizard)*

You have Resistance to Cold damage while you hold this staff.

***Spells.*** The staff has 10 charges. While holding the staff, you can cast one of the spells on the following table from it, using your spell save DC. The table indicates how many charges you must expend to cast the spell.

|  |  |  |  |
|---|---|---|---|
| Spell | Charge Cost | Spell | Charge Cost |
| Cone of Cold | 5 | Ice Storm | 4 |
| Fog Cloud | 1 | Wall of Ice | 4 |

***Regaining Charges.*** The staff regains 1d6 + 4 expended charges daily at dawn. If you expend the last charge, roll 1d20. On a 1, the staff turns to water and is destroyed.

## Effects
```yaml
- defense: { resistance: [cold], when: { wielding: self } }
- charges: { max: 10, recharge: { dice: 1d6 + 4, at: dawn }, destroy-on: { roll: 1d20, if: 1, when: last-charge } }
- cast-list: { pay-from: charges, dc: spell:dc, spells: [ { spell: $srd/spells/cone-of-cold, cost: 5 }, { spell: $srd/spells/fog-cloud, cost: 1 },
                                                      { spell: $srd/spells/ice-storm, cost: 4 }, { spell: $srd/spells/wall-of-ice, cost: 4 } ] }
```
