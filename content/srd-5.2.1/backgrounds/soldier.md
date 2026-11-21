# Soldier
**Type:** Background
**Source:** SRD 5.2.1, p. 83
**Ability Scores:** Strength, Dexterity, Constitution
**Feat:** Savage Attacker (see “Feats”)
**Skill Proficiencies:** Athletics and Intimidation
**Tool Proficiency:** *Choose one kind of Gaming Set* (see “Equipment”)
**Equipment:** *Choose A or B:* (A) Spear, Shortbow, 20 Arrows, Gaming Set (same as above), Healer’s Kit, Quiver, Traveler’s Clothes, 14 GP; or (B) 50 GP

## Effects
```yaml
- choose: { id: gaming-set, kind: tool, count: 1, grants: proficiency, from: { tool: { category: gaming-set } } }
- equipment:
    options:
      - { id: a, items: [spear, shortbow, { arrows: 20 }, choice:gaming-set, healers-kit, quiver, travelers-clothes], gp: 14 }
      - { id: b, gp: 50 }
```
