# Torch
**Type:** Gear
**Cost:** 1 CP
**Weight:** 1 lb.
**Source:** SRD 5.2.1, p. 100

A Torch burns for 1 hour, casting Bright Light in a 20-foot radius and Dim Light for an additional 20 feet. When you take the Attack action, you can attack with the Torch, using it as a Simple Melee weapon. On a hit, the target takes 1 Fire damage.

## Effects
```yaml
- toggle: { activation: utilize, duration: { amount: 1, unit: hour }, effects: [ { trait: { light: { bright: 20, dim: 20 } } } ] }
- weapon-rule: { as: simple-melee, damage: { dice: 1, type: fire } }
```
