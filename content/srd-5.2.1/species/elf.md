# Elf
**Type:** Species
**Source:** SRD 5.2.1, p. 84
**Creature Type:** Humanoid
**Size:** Medium (about 5–6 feet tall)
**Speed:** 30 feet

As an Elf, you have these special traits.

## Darkvision

You have Darkvision with a range of 60 feet.

## Effects
```yaml
- sense: { darkvision: 60 }
```

## Elven Lineage

You are part of a lineage that grants you supernatural abilities. Choose a lineage from the Elven Lineages table. You gain the level 1 benefit of that lineage.

When you reach character levels 3 and 5, you learn a higher-level spell, as shown on the table. You always have that spell prepared. You can cast it once without a spell slot, and you regain the ability to cast it in that way when you finish a Long Rest. You can also cast the spell using any spell slots you have of the appropriate level.

Intelligence, Wisdom, or Charisma is your spellcasting ability for the spells you cast with this trait (choose the ability when you select the lineage).

## Effects
```yaml
- choose: { id: lineage-ability, kind: ability, count: 1, from: [int, wis, cha] }
- choose:
    id: lineage
    kind: option
    options:
      - id: drow
        label: Drow
        effects:
          - sense: { darkvision: 120 }
          - grant-spell: { spell: $srd/spells/dancing-lights, ability: choice:lineage-ability }
          - grant-spell: { spell: $srd/spells/faerie-fire, level: 3, prepared: always, free: { per: long, count: 1 }, ability: choice:lineage-ability }
          - grant-spell: { spell: $srd/spells/darkness, level: 5, prepared: always, free: { per: long, count: 1 }, ability: choice:lineage-ability }
      - id: high-elf
        label: High Elf
        effects:
          - grant-spell: { choose: { id: high-elf-cantrip, count: 1, from: { spell: { list: wizard, level: 0 } }, swap: { at: long, count: 1 },
                                     default: $srd/spells/prestidigitation }, ability: choice:lineage-ability }
          - grant-spell: { spell: $srd/spells/detect-magic, level: 3, prepared: always, free: { per: long, count: 1 }, ability: choice:lineage-ability }
          - grant-spell: { spell: $srd/spells/misty-step, level: 5, prepared: always, free: { per: long, count: 1 }, ability: choice:lineage-ability }
      - id: wood-elf
        label: Wood Elf
        effects:
          - set: { to: speed:walk, value: 35 }
          - grant-spell: { spell: $srd/spells/druidcraft, ability: choice:lineage-ability }
          - grant-spell: { spell: $srd/spells/longstrider, level: 3, prepared: always, free: { per: long, count: 1 }, ability: choice:lineage-ability }
          - grant-spell: { spell: $srd/spells/pass-without-trace, level: 5, prepared: always, free: { per: long, count: 1 }, ability: choice:lineage-ability }
```

## Fey Ancestry

You have Advantage on saving throws you make to avoid or end the Charmed condition.

## Effects
```yaml
- advantage: { roll: save:all, scope: { against: { condition: charmed } } }
```

## Keen Senses

You have proficiency in the Insight, Perception, or Survival skill.

## Effects
```yaml
- choose: { id: keen-senses, kind: skill, count: 1, grants: proficiency, from: [insight, perception, survival] }
```

## Trance

You don’t need to sleep, and magic can’t put you to sleep. You can finish a Long Rest in 4 hours if you spend those hours in a trancelike meditation, during which you retain consciousness.

## Effects
```yaml
- defense: { condition-immunity: [magical-sleep] }
- trait: { text: "You don't need to sleep. You can finish a Long Rest in 4 hours of trance, staying conscious." }
```

## Elven Lineages

| Lineage | Level 1 | Level 3 | Level 5 |
|---|---|---|---|
| Drow | The range of your Darkvision increases to 120 feet. You also know the Dancing Lights cantrip. | Faerie Fire | Darkness |
| High Elf | You know the Prestidigitation cantrip. Whenever you finish a Long Rest, you can replace that cantrip with a different cantrip from the Wizard spell list. | Detect Magic | Misty Step |
| Wood Elf | Your Speed increases to 35 feet. You also know the Druidcraft cantrip. | Longstrider | Pass without Trace |
