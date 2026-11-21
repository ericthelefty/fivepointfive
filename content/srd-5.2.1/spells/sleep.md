# Sleep
**Type:** Spell
**Source:** SRD 5.2.1, p. 163
*Level 1 Enchantment (Bard, Sorcerer, Wizard)*
**Casting Time:** Action
**Range:** 60 feet
**Components:** V, S, M (a pinch of sand or rose petals)
**Duration:** Concentration, up to 1 minute

Each creature of your choice in a 5-foot-radius Sphere centered on a point within range must succeed on a Wisdom saving throw or have the Incapacitated condition until the end of its next turn, at which point it must repeat the save. If the target fails the second save, the target has the Unconscious condition for the duration. The spell ends on a target if it takes damage or someone within 5 feet of it takes an action to shake it out of the spell’s effect.

Creatures that don’t sleep, such as elves, or that have Immunity to the Exhaustion condition automatically succeed on saves against this spell.

## Effects
```yaml
- action: { area: { shape: sphere, size: 5 }, targets: { choose: true }, save: { ability: wis },
            apply: { condition: incapacitated, duration: { until: end-of-next-turn }, ends-when: damage },
            then: { save: { ability: wis }, apply: { condition: unconscious, duration: spell } },
            auto-succeed: { creature: { immune: exhaustion, sleeps: false } } }
```
