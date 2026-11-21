# Rod of Rulership
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 242
*Rod, Rare (Requires Attunement)*

You can take a Magic action to present the rod and command obedience from each creature of your choice that you can see within 120 feet of yourself. Each target must succeed on a DC 15 Wisdom saving throw or have the Charmed condition for 8 hours. While Charmed in this way, the creature regards you as its trusted leader. If harmed by you or your allies or commanded to do something contrary to its nature, a target ceases to be Charmed in this way. Once used, this property can’t be used again until the next dawn.

## Effects
```yaml
- resource: { id: rulership, max: 1, reset: dawn }
- action: { activation: magic, cost: { resource: $#rulership }, range: 120, targets: { count: any, choose: true }, save: { ability: wis, dc: 15 },
            on-failure: { apply: { condition: charmed, duration: { amount: 8, unit: hour }, ends-when: damage-by-you-or-allies } } }
```
