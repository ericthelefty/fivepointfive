# Holy Aura
**Type:** Spell
**Source:** SRD 5.2.1, p. 141
*Level 8 Abjuration (Cleric)*
**Casting Time:** Action
**Range:** Self
**Components:** V, S, M (a reliquary worth 1,000+ GP)
**Duration:** Concentration, up to 1 minute

For the duration, you emit an aura in a 30-foot Emanation. While in the aura, creatures of your choice have Advantage on all saving throws, and other creatures have Disadvantage on attack rolls against them. In addition, when a Fiend or an Undead hits an affected creature with a melee attack roll, the attacker must succeed on a Constitution saving throw or have the Blinded condition until the end of its next turn.

## Effects
```yaml
- aura: { id: holy-aura, area: { shape: emanation, size: 30 }, affects: [chosen],
          effects: [ { advantage: { roll: save:all } }, { disadvantage: { roll: attacks-against-you } },
                     { trigger: { event: hit-by, auto: true, if: "A Fiend or Undead hits with a melee attack roll",
                                  offer: { save: { ability: con, dc: spell:dc }, apply: { condition: blinded, duration: { until: end-of-target-next-turn } } } } } ] }
```
