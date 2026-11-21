# Greater Invisibility
**Type:** Spell
**Source:** SRD 5.2.1, p. 137
*Level 4 Illusion (Bard, Sorcerer, Wizard)*
**Casting Time:** Action
**Range:** Touch
**Components:** V, S
**Duration:** Concentration, up to 1 minute

A creature you touch has the Invisible condition until the spell ends.

## Effects
```yaml
- action: { range: touch, targets: { count: 1 }, apply: { condition: invisible, duration: spell } }
```
