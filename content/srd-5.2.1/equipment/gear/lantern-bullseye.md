# Lantern, Bullseye
**Type:** Gear
**Cost:** 10 GP
**Source:** SRD 5.2.1, p. 98

A Bullseye Lantern burns Oil as fuel to cast Bright Light in a 60-foot Cone and Dim Light for an additional 60 feet.

## Effects
```yaml
- toggle: { activation: utilize, effects: [ { trait: { light: { bright: 60, dim: 60, shape: cone } } } ] }
```
