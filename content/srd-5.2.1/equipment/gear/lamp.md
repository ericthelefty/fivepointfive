# Lamp
**Type:** Gear
**Cost:** 5 SP
**Weight:** 1 lb.
**Source:** SRD 5.2.1, p. 98

A Lamp burns Oil as fuel to cast Bright Light in a 15-foot radius and Dim Light for an additional 30 feet.

## Effects
```yaml
- toggle: { activation: utilize, effects: [ { trait: { light: { bright: 15, dim: 30 } } } ] }
```
