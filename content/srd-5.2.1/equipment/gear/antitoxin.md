# Antitoxin
**Type:** Gear
**Cost:** 50 GP
**Source:** SRD 5.2.1, p. 96

As a Bonus Action, you can drink a vial of Antitoxin to gain Advantage on saving throws to avoid or end the Poisoned condition for 1 hour.

## Effects
```yaml
- action: { activation: bonus, consume: true, duration: { amount: 1, unit: hour }, effects: [ { advantage: { roll: save:all, scope: { against: { condition: poisoned } } } } ] }
```
