# Jeweler’s Tools
**Type:** Tool
**Cost:** 25 GP
**Source:** SRD 5.2.1, p. 93
**Ability:** Intelligence
**Weight:** 2 lb.
**Utilize:** Discern a gem’s value (DC 15)
**Craft:** Arcane Focus, Holy Symbol

## Effects
```yaml
- action:
    activation: utilize
    label: Discern a gem’s value
    check: {tool: self, ability: int, dc: 15}
- craft:
    items: [arcane-focus, holy-symbol]
```
