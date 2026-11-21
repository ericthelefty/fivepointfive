# Revivify
**Type:** Spell
**Source:** SRD 5.2.1, p. 159
*Level 3 Necromancy (Cleric, Druid, Paladin, Ranger)*
**Casting Time:** Action
**Range:** Touch
**Components:** V, S, M (a diamond worth 300+ GP, which the spell consumes)
**Duration:** Instantaneous

You touch a creature that has died within the last minute. That creature revives with 1 Hit Point. This spell can’t revive a creature that has died of old age, nor does it restore any missing body parts.

## Effects
```yaml
- action: { range: touch, revive: { dead-max: { amount: 1, unit: minute }, hp: 1 } }
```
