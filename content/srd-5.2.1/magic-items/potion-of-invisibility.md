# Potion of Invisibility
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 236
*Potion, Rare*

This potion’s container looks empty but feels as though it holds liquid. When you drink the potion, you have the Invisible condition for 1 hour. The effect ends early if you make an attack roll, deal damage, or cast a spell.

## Effects
```yaml
- action: { activation: bonus, consume: true, apply: { condition: invisible, duration: { amount: 1, unit: hour }, ends-when: [attack, damage, cast] } }
```
