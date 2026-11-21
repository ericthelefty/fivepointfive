# Irresistible Dance
**Type:** Spell
**Source:** SRD 5.2.1, p. 143
*Level 6 Enchantment (Bard, Wizard)*
**Casting Time:** Action
**Range:** 30 feet
**Components:** V
**Duration:** Concentration, up to 1 minute

One creature that you can see within range must make a Wisdom saving throw. On a successful save, the target dances comically until the end of its next turn, during which it must spend all its movement to dance in place.

On a failed save, the target has the Charmed condition for the duration. While Charmed, the target dances comically, must use all its movement to dance in place, and has Disadvantage on Dexterity saving throws and attack rolls, and other creatures have Advantage on attack rolls against it. On each of its turns, the target can take an action to collect itself and repeat the save, ending the spell on itself on a success.

## Effects
```yaml
- action: { targets: { count: 1 }, save: { ability: wis },
            on-success: { apply: { text: "Spends all movement dancing", duration: { until: end-of-target-next-turn } } },
            on-failure: { apply: { condition: charmed, duration: spell, save-ends: action,
              effects: [ { disadvantage: { roll: [save:dex, attack] } }, { advantage: { roll: attacks-against-you } } ] } } }
```
