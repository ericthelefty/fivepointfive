# Sanctuary
**Type:** Spell
**Source:** SRD 5.2.1, p. 159
*Level 1 Abjuration (Cleric)*
**Casting Time:** Bonus Action
**Range:** 30 feet
**Components:** V, S, M (a shard of glass from a mirror)
**Duration:** 1 minute

You ward a creature within range. Until the spell ends, any creature who targets the warded creature with an attack roll or a damaging spell must succeed on a Wisdom saving throw or either choose a new target or lose the attack or spell. This spell doesn’t protect the warded creature from areas of effect. The spell ends if the warded creature makes an attack roll, casts a spell, or deals damage.

## Effects
```yaml
- action: { targets: { count: 1 } }
- target-effects: { effects: [ { trigger: { event: targeted, who: { creature: any }, auto: true, if: "An attack roll or damaging spell",
                                            offer: { save: { ability: wis, dc: spell:dc }, on-failure: { text: "The attacker picks a new target or loses the attack or spell." } } } } ],
                    ends-when: [{ text: "The warded creature attacks, casts a spell or deals damage" }] }
```
