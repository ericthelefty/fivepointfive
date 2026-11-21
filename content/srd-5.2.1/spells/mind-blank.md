# Mind Blank
**Type:** Spell
**Source:** SRD 5.2.1, p. 149
*Level 8 Abjuration (Bard, Wizard)*
**Casting Time:** Action
**Range:** Touch
**Components:** V, S
**Duration:** 24 hours

Until the spell ends, one willing creature you touch has Immunity to Psychic damage and the Charmed condition. The target is also unaffected by anything that would sense its emotions or alignment, read its thoughts, or magically detect its location, and no spell—not even *Wish*—can gather information about the target, observe it remotely, or control its mind.

## Effects
```yaml
- action: { range: touch, targets: { count: 1, creature: willing } }
- target-effects: { effects: [ { defense: { immunity: [psychic], condition-immunity: [charmed] } }, { trait: [immune-divination, immune-mind-reading] } ] }
```
