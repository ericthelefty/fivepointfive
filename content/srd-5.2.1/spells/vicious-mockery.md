# Vicious Mockery
**Type:** Spell
**Source:** SRD 5.2.1, p. 171
*Enchantment Cantrip (Bard)*
**Casting Time:** Action
**Range:** 60 feet
**Components:** V
**Duration:** Instantaneous

You unleash a string of insults laced with subtle enchantments at one creature you can see or hear within range. The target must succeed on a Wisdom saving throw or take 1d6 Psychic damage and have Disadvantage on the next attack roll it makes before the end of its next turn.

***Cantrip Upgrade.*** The damage increases by 1d6 when you reach levels 5 (2d6), 11 (3d6), and 17 (4d6).

## Effects
```yaml
- action: { targets: { count: 1 }, save: { ability: wis }, damage: { dice: 1d6, type: psychic },
            on-failure: { apply: { text: "Disadvantage on its next attack roll", duration: { until: end-of-target-next-turn } } } }
- scaling: { cantrip: [5, 11, 17], add: { damage: 1d6 } }
```
