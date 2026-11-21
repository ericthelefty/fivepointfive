# Warrior of the Open Hand
**Type:** Subclass
**Parent:** Monk
**Source:** SRD 5.2.1, p. 52
*Master Unarmed Combat Techniques*

Warriors of the Open Hand are masters of unarmed combat. They learn techniques to push and trip their opponents and manipulate their own energy to protect themselves from harm.

## Level 3: Open Hand Technique

Whenever you hit a creature with an attack granted by your Flurry of Blows, you can impose one of the following effects on that target.

***Addle.*** The target can’t make Opportunity Attacks until the start of its next turn.

***Push.*** The target must succeed on a Strength saving throw or be pushed up to 15 feet away from you.

***Topple.*** The target must succeed on a Dexterity saving throw or have the Prone condition.

## Effects
```yaml
- trigger:
    event: hit
    scope: { source: $srd/monk#flurry-of-blows }
    offer:
      choose-one:
        - { id: addle, label: Addle, text: "The target can't make Opportunity Attacks until the start of its next turn." }
        - { id: push, label: Push, save: { ability: str, dc: save-dc:monk }, move: { target: 15, direction: away } }
        - { id: topple, label: Topple, save: { ability: dex, dc: save-dc:monk }, apply: { condition: prone } }
```

## Level 6: Wholeness of Body

You gain the ability to heal yourself. As a Bonus Action, you can roll your Martial Arts die. You regain a number of Hit Points equal to the number rolled plus your Wisdom modifier (minimum of 1 Hit Point regained).

You can use this feature a number of times equal to your Wisdom modifier (minimum of once), and you regain all expended uses when you finish a Long Rest.

## Effects
```yaml
- resource: { id: wholeness-of-body, max: "max(1, mod:wis)", reset: long }
- action: { id: wholeness-of-body, activation: bonus, cost: { resource: $#wholeness-of-body },
            heal: "max(1, table:Martial Arts + mod:wis)" }
```

## Level 11: Fleet Step

When you take a Bonus Action other than Step of the Wind, you can also use Step of the Wind immediately after that Bonus Action.

## Effects
```yaml
- trigger: { event: { use: bonus-action }, if: "The Bonus Action wasn't Step of the Wind",
             offer: { text: "Use Step of the Wind immediately after." } }
```

## Level 17: Quivering Palm

You gain the ability to set up lethal vibrations in someone’s body. When you hit a creature with an Unarmed Strike, you can expend 4 Focus Points to start these imperceptible vibrations, which last for a number of days equal to your Monk level. The vibrations are harmless unless you take an action to end them. Alternatively, when you take the Attack action on your turn, you can forgo one of the attacks to end the vibrations. To end them, you and the target must be on the same plane of existence. When you end them, the target must make a Constitution saving throw, taking 10d12 Force damage on a failed save or half as much damage on a successful one.

You can have only one creature under the effect of this feature at a time. You can end the vibrations harmlessly (no action required).

## Effects
```yaml
- trigger:
    id: quivering-palm
    event: hit
    scope: { weapon: { unarmed: true } }
    offer:
      cost: { resource: $srd/monk#focus, amount: 4 }
      apply: { text: "Vibrations", duration: { amount: level:monk, unit: day }, limit: 1 }
- action:
    id: end-vibrations
    activation: [action, forgo-attack]
    requires: { active: $#quivering-palm }
    save: { ability: con, dc: save-dc:monk, success: half }
    damage: { dice: 10d12, type: force }
```
