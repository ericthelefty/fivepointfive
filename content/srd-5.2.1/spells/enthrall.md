# Enthrall
**Type:** Spell
**Source:** SRD 5.2.1, p. 128
*Level 2 Enchantment (Bard, Warlock)*
**Casting Time:** Action
**Range:** 60 feet
**Components:** V, S
**Duration:** Concentration, up to 1 minute

You weave a distracting string of words, causing creatures of your choice that you can see within range to make a Wisdom saving throw. Any creature you or your companions are fighting automatically succeeds on this save. On a failed save, a target has a −10 penalty to Wisdom (Perception) checks and Passive Perception until the spell ends.

## Effects
```yaml
- action: { targets: { count: any, choose: true }, save: { ability: wis, auto-succeed: { text: "You or your companions are fighting it" } } }
- target-effects: { effects: [ { bonus: { to: [skill:perception, passive:perception], value: -10 } } ] }
```
