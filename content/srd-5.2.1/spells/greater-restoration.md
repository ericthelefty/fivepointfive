# Greater Restoration
**Type:** Spell
**Source:** SRD 5.2.1, p. 137
*Level 5 Abjuration (Bard, Cleric, Druid, Paladin, Ranger)*
**Casting Time:** Action
**Range:** Touch
**Components:** V, S, M (diamond dust worth 100+ GP, which the spell consumes)
**Duration:** Instantaneous

You touch a creature and magically remove one of the following effects from it:

- 1 Exhaustion level
- The Charmed or Petrified condition
- A curse, including the target’s Attunement to a cursed magic item
- Any reduction to one of the target’s ability scores
- Any reduction to the target’s Hit Point maximum

## Effects
```yaml
- action: { range: touch, targets: { count: 1 }, choose-one: [
              { id: exhaustion, label: 1 Exhaustion level, exhaustion: -1 },
              { id: condition, label: Charmed or Petrified, remove-condition: { choose: [charmed, petrified] } },
              { id: curse, label: A curse, text: "Ends a curse, including attunement to a cursed item." },
              { id: ability, label: Ability reduction, text: "Ends a reduction to one ability score." },
              { id: hp-max, label: HP maximum reduction, text: "Ends a reduction to the HP maximum." } ] }
```
