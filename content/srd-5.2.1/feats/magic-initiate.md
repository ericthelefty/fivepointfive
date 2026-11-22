# Magic Initiate
**Type:** Feat
**Source:** SRD 5.2.1, p. 87
*Origin Feat*

You gain the following benefits.

## Two Cantrips

You learn two cantrips of your choice from the Cleric, Druid, or Wizard spell list. Intelligence, Wisdom, or Charisma is your spellcasting ability for this feat’s spells (choose when you select this feat).

## Effects
```yaml
- choose: { id: mi-list, kind: option, label: spell list, options: [ { id: cleric }, { id: druid }, { id: wizard } ] }
- choose: { id: mi-ability, kind: ability, label: spellcasting ability, from: [int, wis, cha] }
- grant-spell: { choose: { id: mi-cantrips, count: 2, from: { spell: { list: choice:mi-list, level: 0 } }, swap: { at: level-up, count: 1 } },
                 ability: choice:mi-ability }
```

## Level 1 Spell

Choose a level 1 spell from the same list you selected for this feat’s cantrips. You always have that spell prepared. You can cast it once without a spell slot, and you regain the ability to cast it in that way when you finish a Long Rest. You can also cast the spell using any spell slots you have.

## Effects
```yaml
- grant-spell: { choose: { id: mi-spell, count: 1, from: { spell: { list: choice:mi-list, level: 1 } }, swap: { at: level-up, count: 1 } },
                 prepared: always, free: { per: long, count: 1 }, ability: choice:mi-ability }
```

## Spell Change

Whenever you gain a new level, you can replace one of the spells you chose for this feat with a different spell of the same level from the chosen spell list.

***Repeatable.*** You can take this feat more than once, but you must choose a different spell list each time.
