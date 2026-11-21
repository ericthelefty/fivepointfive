# Brewer’s Supplies
**Type:** Tool
**Cost:** 20 GP
**Source:** SRD 5.2.1, p. 93
**Ability:** Intelligence
**Weight:** 9 lb.
**Utilize:** Detect poisoned drink (DC 15), or identify alcohol (DC 10)
**Craft:** Antitoxin

## Effects
```yaml
- action:
    activation: utilize
    label: Detect poisoned drink
    check: {tool: self, ability: int, dc: 15}
- action:
    activation: utilize
    label: Identify alcohol
    check: {tool: self, ability: int, dc: 10}
- craft:
    items: [antitoxin]
```
