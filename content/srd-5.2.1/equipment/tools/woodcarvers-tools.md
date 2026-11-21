# Woodcarver’s Tools
**Type:** Tool
**Cost:** 1 GP
**Source:** SRD 5.2.1, p. 94
**Ability:** Dexterity
**Weight:** 5 lb.
**Utilize:** Carve a pattern in wood (DC 10)
**Craft:** Club, Greatclub, Quarterstaff, Ranged weapons (except Pistol, Musket, and Sling), Arcane Focus, Arrows, Bolts, Druidic Focus, Ink Pen, Needles

## Effects
```yaml
- action:
    activation: utilize
    label: Carve a pattern in wood
    check: {tool: self, ability: dex, dc: 10}
- craft:
    items: [club, greatclub, quarterstaff, ranged-weapons-except-pistol, musket, and-sling, arcane-focus, arrows, bolts, druidic-focus, ink-pen, needles]
```
