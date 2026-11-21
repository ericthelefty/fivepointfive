# Carpenter’s Tools
**Type:** Tool
**Cost:** 8 GP
**Source:** SRD 5.2.1, p. 93
**Ability:** Strength
**Weight:** 6 lb.
**Utilize:** Seal or pry open a door or container (DC 20)
**Craft:** Club, Greatclub, Quarterstaff, Barrel, Chest, Ladder, Pole, Portable Ram, Torch

## Effects
```yaml
- action:
    activation: utilize
    label: Seal or pry open a door or container
    check: {tool: self, ability: str, dc: 20}
- craft:
    items: [club, greatclub, quarterstaff, barrel, chest, ladder, pole, portable-ram, torch]
```
