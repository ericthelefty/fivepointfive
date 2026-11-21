# Fiend Patron
**Type:** Subclass
**Parent:** Warlock
**Source:** SRD 5.2.1, p. 76
*Make a Deal with the Lower Planes*

Your pact draws on the Lower Planes, the realms of perdition. You might forge a bargain with a demon lord, an archdevil, or another fiend that is especially mighty. That patron’s aims are evil—the corruption or destruction of all things, ultimately including you—and your path is defined by the extent to which you strive against those aims.

## Level 3: Dark One’s Blessing

When you reduce an enemy to 0 Hit Points, you gain Temporary Hit Points equal to your Charisma modifier plus your Warlock level (minimum of 1 Temporary Hit Point). You also gain this benefit if someone else reduces an enemy within 10 feet of you to 0 Hit Points.

## Effects
```yaml
- trigger: { event: reduce-to-zero, if: "You reduced an enemy to 0 HP, or someone else did within 10 feet of you", auto: false,
             offer: { temp-hp: "max(1, mod:cha + level:warlock)" } }
```

## Level 3: Fiend Spells

The magic of your patron ensures you always have certain spells ready; when you reach a Warlock level specified in the Fiend Spells table, you thereafter always have the listed spells prepared.

## Effects
```yaml
- spell-list: { prepared: always, by-level: {
    3: [$srd/spells/burning-hands, $srd/spells/command, $srd/spells/scorching-ray, $srd/spells/suggestion],
    5: [$srd/spells/fireball, $srd/spells/stinking-cloud],
    7: [$srd/spells/fire-shield, $srd/spells/wall-of-fire],
    9: [$srd/spells/geas, $srd/spells/insect-plague] } }
```

### Fiend Spells

| Warlock Level | Spells |
|---|---|
| 3 | Burning Hands, Command, |
|  | Scorching Ray, Suggestion |
| 5 | Fireball, Stinking Cloud |
| 7 | Fire Shield, Wall of Fire |
| 9 | Geas, Insect Plague |

## Level 6: Dark One’s Own Luck

You can call on your fiendish patron to alter fate in your favor. When you make an ability check or a saving throw, you can use this feature to add 1d10 to your roll. You can do so after seeing the roll but before any of the roll’s effects occur.

You can use this feature a number of times equal to your Charisma modifier (minimum of once), but you can use it no more than once per roll. You regain all expended uses when you finish a Long Rest.

## Effects
```yaml
- resource: { id: own-luck, max: "max(1, mod:cha)", reset: long }
- trigger: { event: { roll: [check, save] }, per: roll, offer: { add-roll: 1d10, cost: { resource: $#own-luck } } }
```

## Level 10: Fiendish Resilience

Choose one damage type, other than Force, whenever you finish a Short or Long Rest. You have Resistance to that damage type until you choose a different one with this feature.

## Effects
```yaml
- choose: { id: resilience, kind: damage-type, count: 1, from: { not: [force] }, swap: { at: [short, long], count: all } }
- defense: { resistance: [choice:resilience] }
```

## Level 14: Hurl Through Hell

Once per turn when you hit a creature with an attack roll, you can try to instantly transport the target through the Lower Planes. The target must succeed on a Charisma saving throw against your spell save DC, or the target disappears and hurtles through a nightmare landscape. The target takes 8d10 Psychic damage if it isn’t a Fiend, and it has the Incapacitated condition until the end of your next turn, when it returns to the space it previously occupied or the nearest unoccupied space.

Once you use this feature, you can’t use it again until you finish a Long Rest unless you expend a Pact Magic spell slot (no action required) to restore your use of it.

## Effects
```yaml
- resource: { id: hurl, max: 1, reset: long }
- convert: { from: { slot: pact }, to: { resource: $#hurl, amount: 1 }, activation: none, if-empty: true }
- trigger: { event: hit, per: turn, scope: { any: [ { weapon: {} }, { spell: {} } ] },
             offer: { cost: { resource: $#hurl }, save: { ability: cha, dc: spell:dc },
                      damage: { dice: 8d10, type: psychic, text: "Not if the target is a Fiend" },
                      apply: { condition: incapacitated, duration: { until: end-of-next-turn }, text: "The target vanishes and returns at the end of your next turn." } } }
```
