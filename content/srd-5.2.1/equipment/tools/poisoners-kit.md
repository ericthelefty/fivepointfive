# Poisoner’s Kit
**Type:** Tool
**Cost:** 50 GP
**Source:** SRD 5.2.1, p. 94
**Ability:** Intelligence
**Weight:** 2 lb.
**Utilize:** Detect a poisoned object (DC 10)
**Craft:** Basic Poison

## Effects
```yaml
- action:
    activation: utilize
    label: Detect a poisoned object
    check: {tool: self, ability: int, dc: 10}
- craft:
    items: [basic-poison]
```
