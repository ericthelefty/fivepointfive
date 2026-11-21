# Cook’s Utensils
**Type:** Tool
**Cost:** 1 GP
**Source:** SRD 5.2.1, p. 93
**Ability:** Wisdom
**Weight:** 8 lb.
**Utilize:** Improve food’s flavor (DC 10), or detect spoiled or poisoned food (DC 15)
**Craft:** Rations

## Effects
```yaml
- action:
    activation: utilize
    label: Improve food’s flavor
    check: {tool: self, ability: wis, dc: 10}
- action:
    activation: utilize
    label: Detect spoiled or poisoned food
    check: {tool: self, ability: wis, dc: 15}
- craft:
    items: [rations]
```
