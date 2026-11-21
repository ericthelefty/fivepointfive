# Pipes of Haunting
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 234
*Wondrous Item, Uncommon*

These pipes have 3 charges and regain 1d3 expended charges daily at dawn. You can take a Magic action to play them and expend 1 charge to create an eerie, spellbinding tune. Each creature of your choice within 30 feet of you must succeed on a DC 15 Wisdom saving throw or have the Frightened condition for 1 minute. A creature that fails the save repeats it at the end of each of its turns, ending the effect on itself on a success. A creature that succeeds on its save is immune to the effect of these pipes for 24 hours.

## Effects
```yaml
- charges: { max: 3, recharge: { dice: 1d3, at: dawn } }
- action: { activation: magic, cost: { charges: 1 }, area: { shape: emanation, size: 30 }, targets: { choose: true }, save: { ability: wis, dc: 15 },
            on-failure: { apply: { condition: frightened, duration: { amount: 1, unit: minute }, save-ends: end-of-turn } }, on-success: { text: "Immune for 24 hours." } }
```
