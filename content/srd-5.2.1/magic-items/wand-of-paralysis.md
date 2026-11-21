# Wand of Paralysis
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 251
*Wand, Rare (Requires Attunement by a Spellcaster)*

This wand has 7 charges. While holding it, you can take a Magic action to expend 1 charge to cause a thin blue ray to streak from the tip toward a creature you can see within 60 feet of yourself. The target must succeed on a DC 15 Constitution saving throw or have the Paralyzed condition for 1 minute. At the end of each of the target’s turns, it repeats the save, ending the effect on itself on a success.

***Regaining Charges.*** The wand regains 1d6 + 1 expended charges daily at dawn. If you expend the wand’s last charge, roll 1d20. On a 1, the wand crumbles into ashes and is destroyed.

## Effects
```yaml
- charges: { max: 7, recharge: { dice: 1d6 + 1, at: dawn }, destroy-on: { roll: 1d20, if: 1, when: last-charge } }
- action: { activation: magic, cost: { charges: 1 }, range: 60, targets: { count: 1 }, save: { ability: con, dc: 15 },
            on-failure: { apply: { condition: paralyzed, duration: { amount: 1, unit: minute }, save-ends: end-of-turn } } }
```
