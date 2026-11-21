# Dissonant Whispers
**Type:** Spell
**Source:** SRD 5.2.1, p. 124
*Level 1 Enchantment (Bard)*
**Casting Time:** Action
**Range:** 60 feet
**Components:** V
**Duration:** Instantaneous

One creature of your choice that you can see within range hears a discordant melody in its mind. The target makes a Wisdom saving throw. On a failed save, it takes 3d6 Psychic damage and must immediately use its Reaction, if available, to move as far away from you as it can, using the safest route. On a successful save, the target takes half as much damage only.

***Using a Higher-Level Spell Slot.*** The damage increases by 1d6 for each spell slot level above 1.

## Effects
```yaml
- action: { targets: { count: 1 }, save: { ability: wis, success: half }, damage: { dice: 3d6, type: psychic },
            on-failure: { text: "It must use its Reaction to move away from you." } }
- scaling: { per-slot-above: 1, add: { damage: 1d6 } }
```
