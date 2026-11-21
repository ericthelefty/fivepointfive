# Potion of Poison
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 236
*Potion, Uncommon*

This concoction looks, smells, and tastes like a *Potion of Healing* or another beneficial potion. However, it is actually poison masked by illusion magic. *Identify* reveals its true nature.

If you drink this potion, you take 4d6 Poison damage and must succeed on a DC 13 Constitution saving throw or have the Poisoned condition for 1 hour.

## Effects
```yaml
- action: { activation: bonus, consume: true, damage: { dice: 4d6, type: poison }, save: { ability: con, dc: 13, self: true },
            on-failure: { apply: { condition: poisoned, duration: { amount: 1, unit: hour } } } }
```
