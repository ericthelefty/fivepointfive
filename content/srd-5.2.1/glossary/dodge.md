# Dodge [Action]
**Type:** Rule
**Source:** SRD 5.2.1, p. 181

If you take the Dodge action, you gain the following benefits: until the start of your next turn, any attack roll made against you has Disadvantage if you can see the attacker, and you make Dexterity saving throws with Advantage.

You lose these benefits if you have the Incapacitated condition or if your Speed is 0.

## Effects
```yaml
- action: { id: dodge, activation: action, duration: { until: start-of-next-turn }, ends-when: [{ condition: incapacitated }, { speed: 0 }],
            effects: [ { disadvantage: { roll: attacks-against-you, when: { player: "You can see the attacker" } } }, { advantage: { roll: save:dex } } ] }
```
