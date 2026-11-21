# Glassblower’s Tools
**Type:** Tool
**Cost:** 30 GP
**Source:** SRD 5.2.1, p. 93
**Ability:** Intelligence
**Weight:** 5 lb.
**Utilize:** Discern what a glass object held in the past 24 hours (DC 15)
**Craft:** Glass Bottle, Magnifying Glass, Spyglass, Vial

## Effects
```yaml
- action:
    activation: utilize
    label: Discern what a glass object held in the past 24 hours
    check: {tool: self, ability: int, dc: 15}
- craft:
    items: [glass-bottle, magnifying-glass, spyglass, vial]
```
