# Prayer of Healing
**Type:** Spell
**Source:** SRD 5.2.1, p. 154
*Level 2 Abjuration (Cleric, Paladin)*
**Casting Time:** 10 minutes
**Range:** 30 feet
**Components:** V
**Duration:** Instantaneous

Up to five creatures of your choice who remain within range for the spell’s entire casting gain the benefits of a Short Rest and also regain 2d8 Hit Points. A creature can’t be affected by this spell again until that creature finishes a Long Rest.

***Using a Higher-Level Spell Slot.*** The healing increases by 1d8 for each spell slot level above 2.

## Effects
```yaml
- action: { targets: { count: 5, choose: true }, heal: 2d8, grant-rest: short, per: { target: long } }
- scaling: { per-slot-above: 2, add: { heal: 1d8 } }
```
