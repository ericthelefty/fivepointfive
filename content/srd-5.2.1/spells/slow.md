# Slow
**Type:** Spell
**Source:** SRD 5.2.1, p. 163
*Level 3 Transmutation (Bard, Sorcerer, Wizard)*
**Casting Time:** Action
**Range:** 120 feet
**Components:** V, S, M (a drop of molasses)
**Duration:** Concentration, up to 1 minute

You alter time around up to six creatures of your choice in a 40-foot Cube within range. Each target must succeed on a Wisdom saving throw or be affected by this spell for the duration.

An affected target’s Speed is halved, it takes a −2 penalty to AC and Dexterity saving throws, and it can’t take Reactions. On its turns, it can take either an action or a Bonus Action, not both, and it can make only one attack if it takes the Attack action. If it casts a spell with a Somatic component, there is a 25 percent chance the spell fails as a result of the target making the spell’s gestures too slowly.

An affected target repeats the save at the end of each of its turns, ending the spell on itself on a success.

## Effects
```yaml
- action: { area: { shape: cube, size: 40 }, targets: { count: 6, choose: true }, save: { ability: wis },
            apply: { duration: spell, save-ends: end-of-turn, effects: [
              { set: { to: speed:all, value: 0.5, mode: multiply } }, { bonus: { to: [ac, save:dex], value: -2 } },
              { trait: [no-reactions, action-or-bonus-action, one-attack] },
              { trait: { text: "25% chance a Somatic spell fails" } } ] } }
```
