# Healer’s Kit
**Type:** Gear
**Cost:** 5 GP
**Source:** SRD 5.2.1, p. 97

A Healer’s Kit has ten uses. As a Utilize action, you can expend one of its uses to stabilize an Unconscious creature that has 0 Hit Points without needing to make a Wisdom (Medicine) check.

## Effects
```yaml
- charges: { max: 10, destroy-on: { when: last-charge } }
- action: { activation: utilize, cost: { charges: 1 }, targets: { count: 1, condition: zero-hp }, stabilize: true }
```
