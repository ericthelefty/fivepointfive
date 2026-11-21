# Power Word Stun
**Type:** Spell
**Source:** SRD 5.2.1, p. 154
*Level 8 Enchantment (Bard, Sorcerer, Warlock, Wizard)*
**Casting Time:** Action
**Range:** 60 feet
**Components:** V
**Duration:** Instantaneous

You overwhelm the mind of one creature you can see within range. If the target has 150 Hit Points or fewer, it has the Stunned condition. Otherwise, its Speed is 0 until the start of your next turn.

The Stunned target makes a Constitution saving throw at the end of each of its turns, ending the condition on itself on a success.

## Effects
```yaml
- action: { targets: { count: 1 }, branch: { if: "target.hp <= 150", then: { apply: { condition: stunned, save-ends: { at: end-of-turn, ability: con } } },
            else: { apply: { text: "Speed 0", duration: { until: start-of-next-turn } } } } }
```
