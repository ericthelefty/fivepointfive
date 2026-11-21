# Hammer of Thunderbolts
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 224
*Weapon (Maul or Warhammer), Legendary (Requires Attunement)*

You gain a +1 bonus to attack rolls and damage rolls made with this magic weapon.

The weapon has 5 charges. You can expend 1 charge and make a ranged attack with the weapon, hurling it as if it had the Thrown property with a normal range of 20 feet and a long range of 60 feet. If the attack hits, the weapon unleashes a thunderclap audible out to 300 feet. The target and every creature within 30 feet of it other than you must succeed on a DC 17 Constitution saving throw or have the Stunned condition until the end of your next turn. Immediately after hitting or missing, the weapon flies back to your hand. The weapon regains 1d4 + 1 expended charges daily at dawn.

***Giant’s Bane.*** While you are attuned to the weapon and wearing either a *Belt of Giant Strength* or *Gauntlets of Ogre Power* to which you are also attuned, you gain the following benefits:

**Giants’ Bane.** When you roll a 20 on the d20 for an attack roll made with this weapon against a Giant, the creature must succeed on a DC 17 Constitution saving throw or die.

**Might of Giants.** The Strength score bestowed by your *Belt of Giant Strength* or *Gauntlets of Ogre Power* increases by 4, to a maximum of 30.

## Effects
```yaml
- bonus: { to: [attack, damage], value: 1, scope: { weapon: { id: self } } }
- charges: { max: 5, recharge: { dice: 1d4 + 1, at: dawn } }
- action: { cost: { charges: 1 }, attack: { weapon: self, thrown: { range: 20/60 } },
            on-hit: { area: { shape: emanation, size: 30, from: target }, save: { ability: con, dc: 17 },
                      on-failure: { apply: { condition: stunned, duration: { until: end-of-next-turn } } } }, text: "Returns to your hand." }
- trigger: { event: { roll: attack }, if-roll: 20, scope: { weapon: { id: self }, against: { creature: giant } },
             when: { has: { attuned: [$srd/magic-items/belt-of-giant-strength, $srd/magic-items/gauntlets-of-ogre-power] } },
             offer: { save: { ability: con, dc: 17 }, on-failure: { text: "It dies." } } }
- modify: { target: [$srd/magic-items/belt-of-giant-strength, $srd/magic-items/gauntlets-of-ogre-power], add: { value: 4 }, max: 30 }
```
