# Staff of Fire
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 245
*Staff, Very Rare (Requires Attunement by a Druid, Sorcerer, Warlock, or Wizard)*

You have Resistance to Fire damage while you hold this staff.

***Spells.*** The staff has 10 charges. While holding the staff, you can cast one of the spells on the following table from it, using your spell save DC. The table indicates how many charges you must expend to cast the spell.

|  |  |  |  |
|---|---|---|---|
| Spell | Charge Cost | Spell | Charge Cost |
| Burning Hands | 1 | Wall of Fire | 4 |
| Fireball | 3 |  |  |

***Regaining Charges.*** The staff regains 1d6 + 4 expended charges daily at dawn. If you expend the last charge, roll 1d20. On a 1, the staff crumbles into cinders and is destroyed.

## Effects
```yaml
- defense: { resistance: [fire] }
- charges: { max: 10, recharge: { dice: 1d6+4, at: dawn }, destroy-on: { roll: 1d20, if: 1, when: last-charge } }
- action:
    activation: magic
    dc: spell:dc
    choose-one:
      - { cast: $srd/spells/burning-hands, cost: { charges: 1 } }
      - { cast: $srd/spells/fireball, cost: { charges: 3 } }
      - { cast: $srd/spells/wall-of-fire, cost: { charges: 4 } }
```
