# Heroism
**Type:** Spell
**Source:** SRD 5.2.1, p. 140
*Level 1 Enchantment (Bard, Paladin)*
**Casting Time:** Action
**Range:** Touch
**Components:** V, S
**Duration:** Concentration, up to 1 minute

A willing creature you touch is imbued with bravery. Until the spell ends, the creature is immune to the Frightened condition and gains Temporary Hit Points equal to your spellcasting ability modifier at the start of each of its turns.

***Using a Higher-Level Spell Slot.*** You can target one additional creature for each spell slot level above 1.

## Effects
```yaml
- action: { range: touch, targets: { count: 1, creature: willing } }
- target-effects:
    effects:
      - defense: { condition-immunity: [frightened] }
      - trigger: { event: start-of-turn, auto: true, offer: { temp-hp: spell-ability } }
- scaling: { per-slot-above: 1, add: { targets: 1 } }
```
