# Wand of Binding
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 250
*Wand, Rare (Requires Attunement)*

This wand has 7 charges.

***Spells.*** While holding the wand, you can cast one of the spells (save DC 17) on the following table from it. The table indicates how many charges you must expend to cast the spell.

|  |  |
|---|---|
| Spell | Charge Cost |
| Hold Monster | 5 |
| Hold Person | 2 |

***Regaining Charges.*** The wand regains 1d6 + 1 expended charges daily at dawn. If you expend the wand’s last charge, roll 1d20. On a 1, the wand crumbles into ashes and is destroyed.

## Effects
```yaml
- charges: { max: 7, recharge: { dice: 1d6 + 1, at: dawn }, destroy-on: { roll: 1d20, if: 1, when: last-charge } }
- cast-list: { pay-from: charges, dc: 17, spells: [ { spell: $srd/spells/hold-monster, cost: 5 }, { spell: $srd/spells/hold-person, cost: 2 } ] }
```
