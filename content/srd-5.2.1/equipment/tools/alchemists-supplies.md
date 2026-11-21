# Alchemist’s Supplies
**Type:** Tool
**Cost:** 50 GP
**Source:** SRD 5.2.1, p. 93
**Ability:** Intelligence
**Weight:** 8 lb.
**Utilize:** Identify a substance (DC 15), or start a fire (DC 15)
**Craft:** Acid, Alchemist’s Fire, Component Pouch, Oil, Paper, Perfume

## Effects
```yaml
- action:
    activation: utilize
    label: Identify a substance
    check: {tool: self, ability: int, dc: 15}
- action:
    activation: utilize
    label: Start a fire
    check: {tool: self, ability: int, dc: 15}
- craft:
    items: [acid, alchemists-fire, component-pouch, oil, paper, perfume]
```
