# Bestow Curse
**Type:** Spell
**Source:** SRD 5.2.1, p. 112
*Level 3 Necromancy (Bard, Cleric, Wizard)*
**Casting Time:** Action
**Range:** Touch
**Components:** V, S
**Duration:** Concentration, up to 1 minute

You touch a creature, which must succeed on a Wisdom saving throw or become cursed for the duration. Until the curse ends, the target suffers one of the following effects of your choice:

- Choose one ability. The target has Disadvantage on ability checks and saving throws made with that ability.
- The target has Disadvantage on attack rolls against you.
- In combat, the target must succeed on a Wisdom saving throw at the start of each of its turns or be forced to take the Dodge action on that turn.
- If you deal damage to the target with an attack roll or a spell, the target takes an extra 1d8 Necrotic damage.

***Using a Higher-Level Spell Slot.*** If you cast this spell using a level 4 spell slot, you can maintain Concentration on it for up to 10 minutes. If you use a level 5+ spell slot, the spell doesn’t require Concentration, and the duration becomes 8 hours (level 5–6 slot) or 24 hours (level 7–8 slot). If you use a level 9 spell slot, the spell lasts until dispelled.

## Effects
```yaml
- action:
    range: touch
    save: { ability: wis }
    choose-one:
      - { id: ability, label: Weak ability, choose: { kind: ability }, apply: { effects: [ { disadvantage: { roll: [check:chosen, save:chosen] } } ] } }
      - { id: against-you, label: Disadvantage against you, apply: { text: "Disadvantage on attack rolls against you." } }
      - { id: dodge, label: Forced Dodge, apply: { text: "Wis save at the start of each of its turns or it must take the Dodge action." } }
      - { id: extra-damage, label: Extra damage, apply: { text: "Your attacks and spells deal it an extra 1d8 Necrotic damage." } }
- scaling: { slots: { "4": { duration: { amount: 10, unit: minute, concentration: true } },
                      "5-6": { duration: { amount: 8, unit: hour, concentration: false } },
                      "7-8": { duration: { amount: 24, unit: hour, concentration: false } },
                      "9": { duration: until-dispelled } } }
```
