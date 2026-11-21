# Compulsion
**Type:** Spell
**Source:** SRD 5.2.1, p. 117
*Level 4 Enchantment (Bard)*
**Casting Time:** Action
**Range:** 30 feet
**Components:** V, S
**Duration:** Concentration, up to 1 minute

Each creature of your choice that you can see within range must succeed on a Wisdom saving throw or have the Charmed condition until the spell ends.

For the duration, you can take a Bonus Action to designate a direction that is horizontal to you. Each Charmed target must use as much of its movement as possible to move in that direction on its next turn, taking the safest route. After moving in this way, a target repeats the save, ending the spell on itself on a success.

## Effects
```yaml
- action: { targets: { count: any, choose: true }, save: { ability: wis }, apply: { condition: charmed, duration: spell,
            text: "Bonus Action: name a direction; each target must move that way, then repeats the save." } }
```
