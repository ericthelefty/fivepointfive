# Mace of Terror
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 229
*Weapon (Mace), Rare (Requires Attunement)*

This magic weapon has 3 charges and regains 1d3 expended charges daily at dawn. While holding the weapon, you can take a Magic action and expend 1 charge to release a wave of terror from it. Each creature of your choice within 30 feet of you must succeed on a DC 15 Wisdom saving throw or have the Frightened condition for 1 minute. While Frightened in this way, a creature must spend its turns trying to move as far away from you as it can, and it can’t make Opportunity Attacks. For its action, it can use only the Dash action or try to escape from an effect that prevents it from moving. If it has nowhere it can move, the creature can take the Dodge action. At the end of each of its turns, a creature repeats the save, ending the effect on itself on a success.

## Effects
```yaml
- charges: { max: 3, recharge: { dice: 1d3, at: dawn } }
- action: { activation: magic, cost: { charges: 1 }, area: { shape: emanation, size: 30 }, targets: { choose: true }, save: { ability: wis, dc: 15 },
            on-failure: { apply: { condition: frightened, duration: { amount: 1, unit: minute }, save-ends: end-of-turn,
              text: "Moves away from you; no Opportunity Attacks; uses its action only to Dash or escape." } } }
```
