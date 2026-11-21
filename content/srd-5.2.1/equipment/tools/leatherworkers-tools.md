# Leatherworker’s Tools
**Type:** Tool
**Cost:** 5 GP
**Source:** SRD 5.2.1, p. 93
**Ability:** Dexterity
**Weight:** 5 lb.
**Utilize:** Add a design to a leather item (DC 10)
**Craft:** Sling, Whip, Hide Armor, Leather Armor, Studded Leather Armor, Backpack, Crossbow Bolt Case, Map or Scroll Case, Parchment, Pouch, Quiver, Waterskin

## Effects
```yaml
- action:
    activation: utilize
    label: Add a design to a leather item
    check: {tool: self, ability: dex, dc: 10}
- craft:
    items: [sling, whip, hide-armor, leather-armor, studded-leather-armor, backpack, crossbow-bolt-case, map, scroll-case, parchment, pouch, quiver, waterskin]
```
