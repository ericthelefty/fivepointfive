# Spare the Dying
**Type:** Spell
**Source:** SRD 5.2.1, p. 163
*Necromancy Cantrip (Cleric, Druid)*
**Casting Time:** Action
**Range:** 15 feet
**Components:** V, S
**Duration:** Instantaneous

Choose a creature within range that has 0 Hit Points and isn’t dead. The creature becomes Stable.

***Cantrip Upgrade.*** The range doubles when you reach levels 5 (30 feet), 11 (60 feet), and 17 (120 feet).

## Effects
```yaml
- action: { targets: { count: 1, condition: zero-hp }, stabilize: true }
- scaling: { cantrip: [5, 11, 17], multiply: { range: 2 } }
```
