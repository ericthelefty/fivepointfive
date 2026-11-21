# Forgery Kit
**Type:** Tool
**Cost:** 15 GP
**Source:** SRD 5.2.1, p. 94
**Ability:** Dexterity
**Weight:** 5 lb.
**Utilize:** Mimic 10 or fewer words of someone else’s handwriting (DC 15), or duplicate a wax seal (DC 20)

## Effects
```yaml
- action:
    activation: utilize
    label: Mimic 10 or fewer words of someone else’s handwriting
    check: {tool: self, ability: dex, dc: 15}
- action:
    activation: utilize
    label: Duplicate a wax seal
    check: {tool: self, ability: dex, dc: 20}
```
