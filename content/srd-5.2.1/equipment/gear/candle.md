# Candle
**Type:** Gear
**Cost:** 1 CP
**Source:** SRD 5.2.1, p. 96

For 1 hour, a lit Candle sheds Bright Light in a 5-foot radius and Dim Light for an additional 5 feet.

## Effects
```yaml
- toggle: { activation: utilize, duration: { amount: 1, unit: hour }, effects: [ { trait: { light: { bright: 5, dim: 5 } } } ] }
```
