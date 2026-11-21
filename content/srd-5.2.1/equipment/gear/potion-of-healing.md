# Potion of Healing
**Type:** Gear
**Cost:** 50 GP
**Source:** SRD 5.2.1, p. 99

This potion is a magic item. As a Bonus Action, you can drink it or administer it to another creature within 5 feet of yourself. The creature that drinks the magical red fluid in this vial regains 2d4 + 2 Hit Points.

## Effects
```yaml
- action: { activation: bonus, range: 5, consume: true, heal: 2d4 + 2 }
```
