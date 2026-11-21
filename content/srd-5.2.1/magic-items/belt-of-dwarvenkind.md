# Belt of Dwarvenkind
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 213
*Wondrous Item, Rare (Requires Attunement)*

While wearing this belt, you gain the following benefits:

**Dwarvish.** You know Dwarvish.

**Friend of Dwarvenkind.** You have Advantage on Charisma (Persuasion) checks made to interact with dwarves and duergar.

**Toughness.** Your Constitution increases by 2, to a maximum of 20. In addition, while attuned to the belt, you have a 50 percent chance each day at dawn of growing a full beard if you can grow one, or a thicker beard if you already have one.

If you aren’t a dwarf or duergar, you gain the following additional benefits while wearing the belt:

**Darkvision.** You have Darkvision with a range of 60 feet.

**Resilience.** You have Resistance to Poison damage. You also have Advantage on saving throws you make to avoid or end the Poisoned condition.

## Effects
```yaml
- language: [dwarvish]
- advantage: { roll: skill:persuasion, when: { player: "Interacting with dwarves or duergar" } }
- score: { con: 2, max: 20 }
- sense: { darkvision: 60, when: { not: { species: dwarf } } }
- defense: { resistance: [poison], when: { not: { species: dwarf } } }
- advantage: { roll: save:all, scope: { against: { condition: poisoned } }, when: { not: { species: dwarf } } }
```
