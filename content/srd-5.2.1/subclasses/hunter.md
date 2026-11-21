# Hunter
**Type:** Subclass
**Parent:** Ranger
**Source:** SRD 5.2.1, p. 61
*Protect Nature and People from Destruction*

You stalk prey in the wilds and elsewhere, using your abilities as a Hunter to protect nature and people everywhere from forces that would destroy them.

## Level 3: Hunter’s Lore

You can call on the forces of nature to reveal certain strengths and weaknesses of your prey. While a creature is marked by your *Hunter’s Mark*, you know whether that creature has any Immunities, Resistances, or Vulnerabilities, and if the creature has any, you know what they are.

## Effects
```yaml
- modify: { target: $srd/spells/hunters-mark, add: { text: "You know the marked creature's Immunities, Resistances and Vulnerabilities." } }
```

## Level 3: Hunter’s Prey

You gain one of the following feature options of your choice. Whenever you finish a Short or Long Rest, you can replace the chosen option with the other one.

## Effects
```yaml
- choose: { id: hunters-prey, kind: option, swap: { at: [short, long], count: all }, options: { headings-under: Hunter’s Prey } }
```

### Colossus Slayer

Your tenacity can wear down even the most resilient foes. When you hit a creature with a weapon, the weapon deals an extra 1d8 damage to the target if it’s missing any of its Hit Points. You can deal this extra damage only once per turn.

## Effects
```yaml
- option: { of: $#hunters-prey }
- trigger: { event: hit, scope: { weapon: {} }, per: turn, auto: true, if: "The target is missing any of its Hit Points",
             offer: { damage: { dice: 1d8, type: weapon } } }
```

### Horde Breaker

Once on each of your turns when you make an attack with a weapon, you can make another attack with the same weapon against a different creature that is within 5 feet of the original target, that is within the weapon’s range, and that you haven’t attacked this turn.

## Effects
```yaml
- option: { of: $#hunters-prey }
- trigger: { event: attack, scope: { weapon: {} }, per: turn,
             offer: { text: "Make another attack with the same weapon against a different creature within 5 feet of the original target that you haven't attacked this turn." } }
```

## Level 7: Defensive Tactics

You gain one of the following feature options of your choice. Whenever you finish a Short or Long Rest, you can replace the chosen option with the other one.

## Effects
```yaml
- choose: { id: defensive-tactics, kind: option, swap: { at: [short, long], count: all }, options: { headings-under: Defensive Tactics } }
```

### Escape the Horde

Opportunity Attacks have Disadvantage against you.

## Effects
```yaml
- option: { of: $#defensive-tactics }
- disadvantage: { roll: attacks-against-you, scope: { source: opportunity-attack } }
```

### Multiattack Defense

When a creature hits you with an attack roll, that creature has Disadvantage on all other attack rolls against you this turn.

## Effects
```yaml
- option: { of: $#defensive-tactics }
- trigger: { event: hit-by, auto: true, offer: { text: "That creature has Disadvantage on its other attack rolls against you this turn." } }
```

## Level 11: Superior Hunter’s Prey

Once per turn when you deal damage to a creature marked by your *Hunter’s Mark*, you can also deal that spell’s extra damage to a different creature that you can see within 30 feet of the first creature.

## Effects
```yaml
- trigger: { event: deal-damage, scope: { against: { target: { marked-by: $srd/spells/hunters-mark } } }, per: turn,
             offer: { text: "Deal Hunter's Mark's extra damage to a different creature you can see within 30 feet of the first." } }
```

## Level 15: Superior Hunter’s Defense

When you take damage, you can take a Reaction to give yourself Resistance to that damage and any other damage of the same type until the end of the current turn.

## Effects
```yaml
- trigger: { event: damaged, reaction: true,
             offer: { apply: { duration: { until: end-of-turn }, effects: [ { defense: { resistance: [damage-taken.type] } } ] } } }
```
