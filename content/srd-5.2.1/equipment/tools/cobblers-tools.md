# Cobbler’s Tools
**Type:** Tool
**Cost:** 5 GP
**Source:** SRD 5.2.1, p. 93
**Ability:** Dexterity
**Weight:** 5 lb.
**Utilize:** Modify footwear to give Advantage on the wearer’s next Dexterity (Acrobatics) check (DC 10)
**Craft:** Climber’s Kit

## Effects
```yaml
- action:
    activation: utilize
    label: Check
    check: {tool: self, ability: dex, dc: 10}
- craft:
    items: [climbers-kit]
```
