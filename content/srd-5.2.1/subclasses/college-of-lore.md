# College of Lore
**Type:** Subclass
**Parent:** Bard
**Source:** SRD 5.2.1, p. 35
*Plumb the Depths of Magical Knowledge*

Bards of the College of Lore collect spells and secrets from diverse sources, such as scholarly tomes, mystical rites, and peasant tales. The college’s members gather in libraries and universities to share their lore with one another. They also meet at festivals or affairs of state, where they can expose corruption, unravel lies, and poke fun at self-important figures of authority.

## Level 3: Bonus Proficiencies

You gain proficiency with three skills of your choice.

## Effects
```yaml
- choose: { id: lore-skills, kind: skill, count: 3, grants: proficiency, from: any }
```

## Level 3: Cutting Words

You learn to use your wit to supernaturally distract, confuse, and otherwise sap the confidence and competence of others. When a creature that you can see within 60 feet of yourself makes a damage roll or succeeds on an ability check or attack roll, you can take a Reaction to expend one use of your Bardic Inspiration; roll your Bardic Inspiration die, and subtract the number rolled from the creature’s roll, reducing the damage or potentially turning the success into a failure.

## Effects
```yaml
- trigger:
    event: [ { roll: damage }, { succeed: check }, { succeed: attack } ]
    reaction: true
    who: { creature: other, range: 60, see: true }
    offer: { add-roll: "-table:Bardic Die", cost: { resource: $srd/bard#bardic-inspiration } }
```

## Level 6: Magical Discoveries

You learn two spells of your choice. These spells can come from the Cleric, Druid, or Wizard spell list or any combination thereof (see a class’s section for its spell list). A spell you choose must be a cantrip or a spell for which you have spell slots, as shown in the Bard Features table.

You always have the chosen spells prepared, and whenever you gain a Bard level, you can replace one of the spells with another spell that meets these requirements.

## Effects
```yaml
- choose:
    id: discoveries
    kind: spell
    count: 2
    from: { spell: { list: [cleric, druid, wizard], slot: available } }
    grants: { prepared: always, counts-as: bard }
    swap: { at: level-up, count: 1 }
```

## Level 14: Peerless Skill

When you make an ability check or attack roll and fail, you can expend one use of Bardic Inspiration; roll the Bardic Inspiration die, and add the number rolled to the d20, potentially turning a failure into a success. On a failure, the Bardic Inspiration isn’t expended.

## Effects
```yaml
- trigger:
    event: [ { fail: check }, { fail: attack } ]
    offer: { add-roll: table:Bardic Die, cost: { resource: $srd/bard#bardic-inspiration }, refund: if-fails }
```
