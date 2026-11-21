# Boots of Speed
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 214
*Wondrous Item, Rare (Requires Attunement)*

While you wear these boots, you can take a Bonus Action to click the boots’ heels together. If you do, the boots double your Speed, and any creature that makes an Opportunity Attack against you has Disadvantage on the attack roll. If you click your heels together again, you end the effect.

When you’ve used the boots’ property for a total of 10 minutes, the magic ceases to function for you until you finish a Long Rest.

## Effects
```yaml
- resource: { id: boots-of-speed, max: 10, unit: minute, reset: long, spend: while-active }
- toggle:
    activation: bonus
    cost: { resource: $#boots-of-speed }
    effects:
      - set: { to: speed:walk, value: 2, mode: multiply }
      - disadvantage: { roll: attacks-against-you, scope: { source: opportunity-attack } }
```
