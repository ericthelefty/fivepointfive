# Lesser Restoration
**Type:** Spell
**Source:** SRD 5.2.1, p. 144
*Level 2 Abjuration (Bard, Cleric, Druid, Paladin, Ranger)*
**Casting Time:** Bonus Action
**Range:** Touch
**Components:** V, S
**Duration:** Instantaneous

You touch a creature and end one condition on it: Blinded, Deafened, Paralyzed, or Poisoned.

## Effects
```yaml
- action: { range: touch, targets: { count: 1 }, remove-condition: { choose: [blinded, deafened, paralyzed, poisoned] } }
```
