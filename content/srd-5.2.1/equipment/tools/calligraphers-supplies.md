# Calligrapher’s Supplies
**Type:** Tool
**Cost:** 10 GP
**Source:** SRD 5.2.1, p. 93
**Ability:** Dexterity
**Weight:** 5 lb.
**Utilize:** Write text with impressive flourishes that guard against forgery (DC 15)
**Craft:** Ink, *Spell Scroll*

## Effects
```yaml
- action:
    activation: utilize
    label: Write text with impressive flourishes that guard against forgery
    check: {tool: self, ability: dex, dc: 15}
- craft:
    items: [ink, spell-scroll]
```
