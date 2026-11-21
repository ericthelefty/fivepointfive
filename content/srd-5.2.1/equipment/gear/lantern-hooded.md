# Lantern, Hooded
**Type:** Gear
**Cost:** 5 GP
**Source:** SRD 5.2.1, p. 98

A Hooded Lantern burns Oil as fuel to cast Bright Light in a 30-foot radius and Dim Light for an additional 30 feet. As a Bonus Action, you can lower the hood, reducing the light to Dim Light in a 5-foot radius, or raise it again.

## Effects
```yaml
- toggle: { activation: utilize, effects: [ { trait: { light: { bright: 30, dim: 30 } } } ] }
- action: { activation: bonus, text: "Lower the hood (Dim Light 5 ft) or raise it." }
```
