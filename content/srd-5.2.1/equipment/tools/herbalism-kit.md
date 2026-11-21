# Herbalism Kit
**Type:** Tool
**Cost:** 5 GP
**Source:** SRD 5.2.1, p. 94
**Ability:** Intelligence
**Weight:** 3 lb.
**Utilize:** Identify a plant (DC 10)
**Craft:** Antitoxin, Candle, Healer’s Kit, *Potion of Healing*

## Effects
```yaml
- action:
    activation: utilize
    label: Identify a plant
    check: {tool: self, ability: int, dc: 10}
- craft:
    items: [antitoxin, candle, healers-kit, potion-of-healing]
```
