# Unarmed Strike
**Type:** Rule
**Source:** SRD 5.2.1, p. 190

Instead of using a weapon to make a melee attack, you can use a punch, kick, headbutt, or similar forceful blow. In game terms, this is an Unarmed Strike—a melee attack that involves you using your body to damage, grapple, or shove a target within 5 feet of you.

Whenever you use your Unarmed Strike, choose one of the following options for its effect.

***Damage.*** You make an attack roll against the target. Your bonus to the roll equals your Strength modifier plus your Proficiency Bonus. On a hit, the target takes Bludgeoning damage equal to 1 plus your Strength modifier.

***Grapple.*** The target must succeed on a Strength or Dexterity saving throw (it chooses which), or it has the Grappled condition. The DC for the saving throw and any escape attempts equals 8 plus your Strength modifier and Proficiency Bonus. This grapple is possible only if the target is no more than one size larger than you and if you have a hand free to grab it. *See also* “Grappling.”

***Shove.*** The target must succeed on a Strength or Dexterity saving throw (it chooses which), or you either push it 5 feet away or cause it to have the Prone condition. The DC for the saving throw equals 8 plus your Strength modifier and Proficiency Bonus. This shove is possible only if the target is no more than one size larger than you.

## Effects
```yaml
- action:
    id: unarmed-strike
    attack: { weapon: unarmed }
    choose-one:
      - { id: damage, label: Damage, attack: { bonus: mod:str + prof }, damage: { dice: 1 + mod:str, type: bludgeoning } }
      - { id: grapple, label: Grapple, save: { ability: { choose: [str, dex] }, dc: 8 + mod:str + prof }, on-failure: { apply: { condition: grappled, escape: { dc: 8 + mod:str + prof } } },
          if: "The target is no more than one size larger and you have a free hand" }
      - { id: shove, label: Shove, save: { ability: { choose: [str, dex] }, dc: 8 + mod:str + prof },
          on-failure: { choose-one: [ { move: { target: 5, direction: away } }, { apply: { condition: prone } } ] }, if: "No more than one size larger" }
```
