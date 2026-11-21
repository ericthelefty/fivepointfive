# Staff of Withering
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 248
*Staff, Rare (Requires Attunement)*

This staff has 3 charges and regains 1d3 expended charges daily at dawn.

The staff can be wielded as a magic Quarterstaff. On a hit, it deals damage as a normal Quarterstaff, and you can expend 1 charge to deal an extra 2d10 Necrotic damage to the target and force it to make a DC 15 Constitution saving throw. On a failed save, the target has Disadvantage for 1 hour on any ability check or saving throw that uses Strength or Constitution.

## Effects
```yaml
- charges: { max: 3, recharge: { dice: 1d3, at: dawn } }
- trigger: { event: hit, scope: { weapon: { id: self } }, offer: { cost: { charges: 1 }, damage: { dice: 2d10, type: necrotic }, save: { ability: con, dc: 15 },
             on-failure: { apply: { duration: { amount: 1, unit: hour }, effects: [ { disadvantage: { roll: [check:str, check:con, save:str, save:con] } } ] } } } }
```
