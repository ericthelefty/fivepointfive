# Animal Friendship
**Type:** Spell
**Source:** SRD 5.2.1, p. 107
*Level 1 Enchantment (Bard, Druid, Ranger)*
**Casting Time:** Action
**Range:** 30 feet
**Components:** V, S, M (a morsel of food)
**Duration:** 24 hours

Target a Beast that you can see within range. The target must succeed on a Wisdom saving throw or have the Charmed condition for the duration. If you or one of your allies deals damage to the target, the spells ends.

***Using a Higher-Level Spell Slot.*** You can target one additional Beast for each spell slot level above 1.

## Effects
```yaml
- action: { targets: { count: 1, creature: beast }, save: { ability: wis }, apply: { condition: charmed, duration: spell, ends-when: damage-by-you-or-allies } }
- scaling: { per-slot-above: 1, add: { targets: 1 } }
```
