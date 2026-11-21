# Robe of Scintillating Colors
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 240
*Wondrous Item, Very Rare (Requires Attunement)*

This robe has 3 charges, and it regains 1d3 expended charges daily at dawn. While you wear it, you can take a Magic action and expend 1 charge to cause the garment to display a shifting pattern of dazzling hues until the end of your next turn. During this time, the robe sheds Bright Light in a 30-foot radius and Dim Light for an additional 30 feet, and creatures that can see you have Disadvantage on attack rolls against you. Any creature in the Bright Light that can see you when the robe’s power is activated must succeed on a DC 15 Wisdom saving throw or have the Stunned condition until the effect ends.

## Effects
```yaml
- charges: { max: 3, recharge: { dice: 1d3, at: dawn } }
- toggle: { activation: magic, cost: { charges: 1 }, duration: { until: end-of-next-turn },
            effects: [ { trait: { light: { bright: 30, dim: 30 } } }, { disadvantage: { roll: attacks-against-you, when: { player: "The attacker can see you" } } },
                       { aura: { area: { shape: emanation, size: 30 }, affects: [all], effects: [ { trigger: { event: start-of-turn, offer: { save: { ability: wis, dc: 15 }, on-failure: { apply: { condition: stunned, duration: { until: end-of-target-turn } } } } } } ] } } ] }
```
