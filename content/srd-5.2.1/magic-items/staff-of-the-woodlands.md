# Staff of the Woodlands
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 247
*Staff, Rare (Requires Attunement by a Druid)*

This staff has 6 charges and can be wielded as a magic Quarterstaff that grants a +2 bonus to attack rolls and damage rolls made with it. While holding it, you have a +2 bonus to spell attack rolls.

***Spells.*** While holding the staff, you can cast one of the spells on the following table from it, using your spell save DC. The table indicates how many charges you must expend to cast the spell.

|  |  |
|---|---|
| Spell | Charge Cost |
| Animal Friendship | 1 |
| Awaken | 5 |
| Barkskin | 2 |
| Locate Animals or Plants | 2 |
| Pass without Trace | 2 |
| Speak with Animals | 1 |
| Speak with Plants | 3 |
| Wall of Thorns | 6 |

***Tree Form.*** You can take a Magic action to plant one end of the staff in earth in an unoccupied space and expend 1 charge to transform the staff into a healthy tree. The tree is 60 feet tall and has a 5-foot-diameter trunk, and its branches at the top spread out in a 20-foot radius. The tree appears ordinary but radiates a faint aura of Transmutation magic that can be discerned with the *Detect Magic* spell. While touching the tree and using a Magic action, you return the staff to its normal form. Any creature in the tree falls when the tree reverts to a staff.

***Regaining Charges.*** The staff regains 1d6 expended charges daily at dawn. If you expend the last charge, roll 1d20. On a 1, the staff loses its properties and becomes a nonmagical Quarterstaff.

## Effects
```yaml
- wield-as: { weapon: quarterstaff }
- bonus: { to: [attack, damage], value: 2, scope: { weapon: { id: self } } }
- bonus: { to: spell:attack, value: 2, when: { wielding: self } }
- charges: { max: 6, recharge: { dice: 1d6, at: dawn }, destroy-on: { roll: 1d20, if: 1, when: last-charge } }
- cast-list: { pay-from: charges, dc: spell:dc, spells: [ { spell: $srd/spells/animal-friendship, cost: 1 }, { spell: $srd/spells/awaken, cost: 5 },
    { spell: $srd/spells/barkskin, cost: 2 }, { spell: $srd/spells/locate-animals-or-plants, cost: 2 }, { spell: $srd/spells/pass-without-trace, cost: 2 },
    { spell: $srd/spells/speak-with-animals, cost: 1 }, { spell: $srd/spells/speak-with-plants, cost: 3 }, { spell: $srd/spells/wall-of-thorns, cost: 6 } ] }
- action: { activation: magic, label: Tree Form, text: "Plant the staff to become a 60-foot tree (or revert)." }
```
