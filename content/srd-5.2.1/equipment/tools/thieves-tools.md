# Thieves’ Tools
**Type:** Tool
**Cost:** 25 GP
**Source:** SRD 5.2.1, p. 94
**Ability:** Dexterity
**Weight:** 1 lb.
**Utilize:** Pick a lock (DC 15), or disarm a trap (DC 15)

## Effects
```yaml
- action:
    activation: utilize
    label: Pick a lock
    check: {tool: self, ability: dex, dc: 15}
- action:
    activation: utilize
    label: Disarm a trap
    check: {tool: self, ability: dex, dc: 15}
```
