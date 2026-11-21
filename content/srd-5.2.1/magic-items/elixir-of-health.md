# Elixir of Health
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 220
*Potion, Rare*

When you drink this potion, you are cured of all magical contagions. In addition, the following conditions end on you: Blinded, Deafened, Paralyzed, and Poisoned.

The clear, red liquid has tiny bubbles of light in it.

## Effects
```yaml
- action: { activation: bonus, consume: true, remove-condition: [blinded, deafened, paralyzed, poisoned], text: "Cures all magical contagions." }
```
