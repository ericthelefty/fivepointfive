# Color Spray
**Type:** Spell
**Source:** SRD 5.2.1, p. 116
*Level 1 Illusion (Bard, Sorcerer, Wizard)*
**Casting Time:** Action
**Range:** Self
**Components:** V, S, M (a pinch of colorful sand)
**Duration:** Instantaneous

You launch a dazzling array of flashing, colorful light. Each creature in a 15-foot Cone originating from you must succeed on a Constitution saving throw or have the Blinded condition until the end of your next turn.

## Effects
```yaml
- action: { area: { shape: cone, size: 15 }, save: { ability: con }, apply: { condition: blinded, duration: { until: end-of-next-turn } } }
```
