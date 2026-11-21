# Potter’s Tools
**Type:** Tool
**Cost:** 10 GP
**Source:** SRD 5.2.1, p. 93
**Ability:** Intelligence
**Weight:** 3 lb.
**Utilize:** Discern what a ceramic object held in the past 24 hours (DC 15)
**Craft:** Jug, Lamp

## Effects
```yaml
- action:
    activation: utilize
    label: Discern what a ceramic object held in the past 24 hours
    check: {tool: self, ability: int, dc: 15}
- craft:
    items: [jug, lamp]
```
