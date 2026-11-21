# Cartographer’s Tools
**Type:** Tool
**Cost:** 15 GP
**Source:** SRD 5.2.1, p. 93
**Ability:** Wisdom
**Weight:** 6 lb.
**Utilize:** Draft a map of a small area (DC 15)
**Craft:** Map

## Effects
```yaml
- action:
    activation: utilize
    label: Draft a map of a small area
    check: {tool: self, ability: wis, dc: 15}
- craft:
    items: [map]
```
