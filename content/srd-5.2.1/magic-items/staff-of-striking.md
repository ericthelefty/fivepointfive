# Staff of Striking
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 246
*Staff, Very Rare (Requires Attunement)*

This staff can be wielded as a magic Quarterstaff that grants a +3 bonus to attack rolls and damage rolls made with it.

The staff has 10 charges. When you hit with a melee attack using it, you can expend up to 3 charges. For each charge you expend, the target takes an extra 1d6 Force damage.

***Regaining Charges.*** The staff regains 1d6 + 4 expended charges daily at dawn. If you expend the last charge, roll 1d20. On a 1, the staff becomes a nonmagical Quarterstaff.

## Effects
```yaml
- bonus: { to: [attack, damage], value: 3, scope: { weapon: { id: self } } }
- charges: { max: 10, recharge: { dice: 1d6 + 4, at: dawn }, destroy-on: { roll: 1d20, if: 1, when: last-charge } }
- trigger: { event: hit, scope: { weapon: { id: self, kind: melee } }, offer: { cost: { charges: { min: 1, max: 3 } }, damage: { dice: "dice(cost.charges, d6)", type: force } } }
```
