# Barkskin
**Type:** Spell
**Source:** SRD 5.2.1, p. 112
*Level 2 Transmutation (Druid, Ranger)*
**Casting Time:** Bonus Action
**Range:** Touch
**Component:** V, S, M (a handful of bark)
**Duration:** 1 hour

You touch a willing creature. Until the spell ends, the target’s skin assumes a bark-like appearance, and the target has an Armor Class of 17 if its AC is lower than that.

## Effects
```yaml
- target-effects:
    effects:
      - set: { to: ac, value: 17 }          # set = only if higher
```
