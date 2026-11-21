# Painter’s Supplies
**Type:** Tool
**Cost:** 10 GP
**Source:** SRD 5.2.1, p. 93
**Ability:** Wisdom
**Weight:** 5 lb.
**Utilize:** Paint a recognizable image of something you’ve seen (DC 10)
**Craft:** Druidic Focus, Holy Symbol

## Effects
```yaml
- action:
    activation: utilize
    label: Paint a recognizable image of something you’ve seen
    check: {tool: self, ability: wis, dc: 10}
- craft:
    items: [druidic-focus, holy-symbol]
```
