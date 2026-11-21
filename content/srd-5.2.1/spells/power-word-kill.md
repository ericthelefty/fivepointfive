# Power Word Kill
**Type:** Spell
**Source:** SRD 5.2.1, p. 154
*Level 9 Enchantment (Bard, Sorcerer, Warlock, Wizard)*
**Casting Time:** Action
**Range:** 60 feet
**Component:** V
**Duration:** Instantaneous

You compel one creature you can see within range to die. If the target has 100 Hit Points or fewer, it dies. Otherwise, it takes 12d12 Psychic damage.

## Effects
```yaml
- action: { targets: { count: 1 }, branch: { if: "target.hp <= 100", then: { text: "It dies." }, else: { damage: { dice: 12d12, type: psychic } } } }
```
