# Thief
**Type:** Subclass
**Parent:** Rogue
**Source:** SRD 5.2.1, p. 64
*Hunt for Treasure as a Classic Adventurer*

A mix of burglar, treasure hunter, and explorer, you are the epitome of an adventurer. In addition to improving your agility and stealth, you gain abilities useful for delving into ruins and getting maximum benefit from the magic items you find there.

## Level 3: Fast Hands

As a Bonus Action, you can do one of the following.

***Sleight of Hand.*** Make a Dexterity (Sleight of Hand) check to pick a lock or disarm a trap with Thieves’ Tools or to pick a pocket.

***Use an Object.*** Take the Utilize action, or take the Magic action to use a magic item that requires that action.

## Effects
```yaml
- action: { id: fast-hands, activation: bonus, choose-one: [
    { check: skill:sleight-of-hand, text: "Pick a lock, disarm a trap (Thieves' Tools) or pick a pocket" },
    { take: utilize }, { take: magic, scope: { item: magic } } ] }
```

## Level 3: Second-Story Work

You’ve trained to get into especially hard-to-reach places, granting you these benefits.

***Climber.*** You gain a Climb Speed equal to your Speed.

***Jumper.*** You can determine your jump distance using your Dexterity rather than your Strength.

## Effects
```yaml
- speed: { climb: speed:walk }
- use-ability: { ability: dex, instead-of: str, for: jump }
```

## Level 9: Supreme Sneak

You gain the following Cunning Strike option.

***Stealth Attack (Cost: 1d6).*** If you have the Hide action’s Invisible condition, this attack doesn’t end that condition on you if you end the turn behind Three-Quarters Cover or Total Cover.

## Effects
```yaml
- modify: { target: $srd/rogue#cunning-strike, add: { offer.choose-one: [
    { id: stealth-attack, label: Stealth Attack, cost: { dice-from: $srd/rogue#sneak-attack, count: 1 },
      text: "If you have the Hide action's Invisible condition, this attack doesn't end it if you end the turn behind Three-Quarters or Total Cover." } ] } }
```

## Level 13: Use Magic Device

You’ve learned how to maximize use of magic items, granting you the following benefits.

***Attunement.*** You can attune to up to four magic items at once.

***Charges.*** Whenever you use a magic item property that expends charges, roll 1d6. On a roll of 6, you use the property without expending the charges.

***Scrolls.*** You can use any *Spell Scroll*, using Intelligence as your spellcasting ability for the spell. If the spell is a cantrip or a level 1 spell, you can cast it reliably. If the scroll contains a higher-level spell, you must first succeed on an Intelligence (Arcana) check (DC 10 plus the spell’s level). On a successful check, you cast the spell from the scroll. On a failed check, the scroll disintegrates.

## Effects
```yaml
- set: { to: attunement:slots, value: 4 }
- trigger: { event: { spend: charges }, auto: true, offer: { roll: 1d6, if-roll: 6, refund: spent } }
- custom: { handler: use-magic-device, params: { ability: int, check: { skill: arcana, from-level: 2 } },
            text: "Any Spell Scroll: Intelligence is your spellcasting ability; a level 2+ spell needs an Intelligence (Arcana) check (DC 10 + spell level) first, and on a failure the scroll disintegrates." }
```

## Level 17: Thief’s Reflexes

You are adept at laying ambushes and quickly escaping danger. You can take two turns during the first round of any combat. You take your first turn at your normal Initiative and your second turn at your Initiative minus 10.

## Effects
```yaml
- custom: { handler: thiefs-reflexes, params: { offset: -10 }, text: "First round of combat: take a second turn at your Initiative − 10." }
```
