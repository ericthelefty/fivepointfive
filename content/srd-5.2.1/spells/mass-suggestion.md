# Mass Suggestion
**Type:** Spell
**Source:** SRD 5.2.1, p. 148
*Level 6 Enchantment (Bard, Sorcerer, Wizard)*
**Casting Time:** Action
**Range:** 60 feet
**Components:** V, M (a snake’s tongue)
**Duration:** 24 hours

You suggest a course of activity—described in no more than 25 words—to twelve or fewer creatures you can see within range that can hear and understand you. The suggestion must sound achievable and not involve anything that would obviously deal damage to any of the targets or their allies. For example, you could say, “Walk to the village down that road, and help the villagers there harvest crops until sunset.” Or you could say, “Now is not the time for violence. Drop your weapons, and dance! Stop in an hour.”

Each target must succeed on a Wisdom saving throw or have the Charmed condition for the duration or until you or your allies deal damage to the target. Each Charmed target pursues the suggestion to the best of its ability. The suggested activity can continue for the entire duration, but if the suggested activity can be completed in a shorter time, the spell ends for a target upon completing it.

***Using a Higher-Level Spell Slot.*** The duration is longer with a spell slot of level 7 (10 days), 8 (30 days), or 9 (366 days).

## Effects
```yaml
- action: { targets: { count: 12 }, save: { ability: wis }, apply: { condition: charmed, duration: spell, ends-when: damage-by-you-or-allies,
            text: "Pursues the suggested course of activity." } }
- scaling: { slots: { "7": { duration: { amount: 10, unit: day } }, "8": { duration: { amount: 30, unit: day } }, "9": { duration: { amount: 366, unit: day } } } }
```
