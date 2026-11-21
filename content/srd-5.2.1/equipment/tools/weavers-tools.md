# Weaver’s Tools
**Type:** Tool
**Cost:** 1 GP
**Source:** SRD 5.2.1, p. 94
**Ability:** Dexterity
**Weight:** 5 lb.
**Utilize:** Mend a tear in clothing (DC 10), or sew a Tiny design (DC 10)
**Craft:** Padded Armor, Basket, Bedroll, Blanket, Fine Clothes, Net, Robe, Rope, Sack, String, Tent, Traveler’s Clothes

## Effects
```yaml
- action:
    activation: utilize
    label: Mend a tear in clothing
    check: {tool: self, ability: dex, dc: 10}
- action:
    activation: utilize
    label: Sew a Tiny design
    check: {tool: self, ability: dex, dc: 10}
- craft:
    items: [padded-armor, basket, bedroll, blanket, fine-clothes, net, robe, rope, sack, string, tent, travelers-clothes]
```
