# Mason’s Tools
**Type:** Tool
**Cost:** 10 GP
**Source:** SRD 5.2.1, p. 93
**Ability:** Strength
**Weight:** 8 lb.
**Utilize:** Chisel a symbol or hole in stone (DC 10)
**Craft:** Block and Tackle

## Effects
```yaml
- action:
    activation: utilize
    label: Chisel a symbol or hole in stone
    check: {tool: self, ability: str, dc: 10}
- craft:
    items: [block-and-tackle]
```
