# Goliath
**Type:** Species
**Source:** SRD 5.2.1, p. 85
**Creature Type:** Humanoid
**Size:** Medium (about 7–8 feet tall)
**Speed:** 35 feet

As a Goliath, you have these special traits.

## Giant Ancestry

You are descended from Giants. Choose one of the following benefits—a supernatural boon from your ancestry; you can use the chosen benefit a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest:

## Effects
```yaml
- resource: { id: giant-ancestry, max: prof, reset: long }
- choose: { id: giant-ancestry, kind: option, options: { headings-under: Giant Ancestry } }
```

### Cloud’s Jaunt (Cloud Giant)

As a Bonus Action, you magically teleport up to 30 feet to an unoccupied space you can see.

## Effects
```yaml
- option: { of: $#giant-ancestry }
- action: { activation: bonus, cost: { resource: $#giant-ancestry }, move: { teleport: 30 } }
```

### Fire’s Burn (Fire Giant)

When you hit a target with an attack roll and deal damage to it, you can also deal 1d10 Fire damage to that target.

## Effects
```yaml
- option: { of: $#giant-ancestry }
- trigger: { event: hit, offer: { cost: { resource: $#giant-ancestry }, damage: { dice: 1d10, type: fire } } }
```

### Frost’s Chill (Frost Giant)

When you hit a target with an attack roll and deal damage to it, you can also deal 1d6 Cold damage to that target and reduce its Speed by 10 feet until the start of your next turn.

## Effects
```yaml
- option: { of: $#giant-ancestry }
- trigger: { event: hit, offer: { cost: { resource: $#giant-ancestry }, damage: { dice: 1d6, type: cold },
                                  text: "Target's Speed −10 ft until the start of your next turn." } }
```

### Hill’s Tumble (Hill Giant)

When you hit a Large or smaller creature with an attack roll and deal damage to it, you can give that target the Prone condition.

## Effects
```yaml
- option: { of: $#giant-ancestry }
- trigger: { event: hit, if: "The target is Large or smaller", offer: { cost: { resource: $#giant-ancestry }, apply: { condition: prone } } }
```

### Stone’s Endurance (Stone Giant)

When you take damage, you can take a Reaction to roll 1d12. Add your Constitution modifier to the number rolled and reduce the damage by that total.

## Effects
```yaml
- option: { of: $#giant-ancestry }
- trigger: { event: damaged, reaction: true, offer: { cost: { resource: $#giant-ancestry }, damage-taken: { reduce: 1d12 + mod:con } } }
```

### Storm’s Thunder (Storm Giant)

When you take damage from a creature within 60 feet of you, you can take a Reaction to deal 1d8 Thunder damage to that creature.

## Effects
```yaml
- option: { of: $#giant-ancestry }
- trigger: { event: damaged, reaction: true, if: "The damage came from a creature within 60 feet",
             offer: { cost: { resource: $#giant-ancestry }, damage: { dice: 1d8, type: thunder } } }
```

## Large Form

Starting at character level 5, you can change your size to Large as a Bonus Action if you’re in a big enough space. This transformation lasts for 10 minutes or until you end it (no action required). For that duration, you have Advantage on Strength checks, and your Speed increases by 10 feet. Once you use this trait, you can’t use it again until you finish a Long Rest.

## Effects
```yaml
- resource: { id: large-form, max: 1, reset: long }
- toggle:
    id: large-form
    level: 5
    activation: bonus
    cost: { resource: $#large-form }
    duration: { amount: 10, unit: minute }
    effects:
      - size: large
      - advantage: { roll: check:str }
      - bonus: { to: speed:walk, value: 10 }
```

## Powerful Build

You have Advantage on any ability check you make to end the Grappled condition. You also count as one size larger when determining your carrying capacity.

## Effects
```yaml
- advantage: { roll: check:all, scope: { against: { condition: grappled } } }
- bonus: { to: carry:size, value: 1 }
```
