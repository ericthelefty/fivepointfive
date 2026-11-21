# Dispel Magic
**Type:** Spell
**Source:** SRD 5.2.1, p. 124
*Level 3 Abjuration (Bard, Cleric, Druid, Paladin, Ranger, Sorcerer, Warlock, Wizard)*
**Casting Time:** Action
**Range:** 120 feet
**Components:** V, S
**Duration:** Instantaneous

Choose one creature, object, or magical effect within range. Any ongoing spell of level 3 or lower on the target ends. For each ongoing spell of level 4 or higher on the target, make an ability check using your spellcasting ability (DC 10 plus that spell’s level). On a successful check, the spell ends.

***Using a Higher-Level Spell Slot.*** You automatically end a spell on the target if the spell’s level is equal to or less than the level of the spell slot you use.

## Effects
```yaml
- action: { targets: { count: 1 }, dispel: { auto-max-level: 3, check: { ability: spell-ability, dc: 10 + spell.level } } }
- scaling: { per-slot-above: 3, add: { dispel.auto-max-level: 1 } }
```
