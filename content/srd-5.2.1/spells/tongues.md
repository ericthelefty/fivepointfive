# Tongues
**Type:** Spell
**Source:** SRD 5.2.1, p. 169
*Level 3 Divination (Bard, Cleric, Sorcerer, Warlock, Wizard)*
**Casting Time:** Action
**Range:** Touch
**Components:** V, M (a miniature ziggurat)
**Duration:** 1 hour

This spell grants the creature you touch the ability to understand any spoken or signed language that it hears or sees. Moreover, when the target communicates by speaking or signing, any creature that knows at least one language can understand it if that creature can hear the speech or see the signing.

## Effects
```yaml
- action: { range: touch, targets: { count: 1 } }
- target-effects: { effects: [ { trait: [understand-all-languages, understood-by-all] } ] }
```
