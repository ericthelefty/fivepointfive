# Wand of Enemy Detection
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 250
*Wand, Rare (Requires Attunement)*

This wand has 7 charges. While holding it, you can take a Magic action to expend 1 charge. For 1 minute, you know the direction of the nearest creature Hostile to you within 60 feet, but not its distance from you. The wand can sense the presence of Hostile creatures that are Invisible, ethereal, disguised, or hidden, as well as those in plain sight. The effect ends if you stop holding the wand.

***Regaining Charges.*** The wand regains 1d6 + 1 expended charges daily at dawn. If you expend the wand’s last charge, roll 1d20. On a 1, the wand crumbles into ashes and is destroyed.

## Effects
```yaml
- charges: { max: 7, recharge: { dice: 1d6 + 1, at: dawn }, destroy-on: { roll: 1d20, if: 1, when: last-charge } }
- toggle: { activation: magic, cost: { charges: 1 }, duration: { amount: 1, unit: minute }, effects: [ { note: { stat: sense:detect, text: "Direction of the nearest Hostile creature within 60 ft" } } ] }
```
