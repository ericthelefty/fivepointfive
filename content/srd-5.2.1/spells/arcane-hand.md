# Arcane Hand
**Type:** Spell
**Source:** SRD 5.2.1, p. 110
*Level 5 Evocation (Sorcerer, Wizard)*
**Casting Time:** Action
**Range:** 120 feet
**Components:** V, S, M (an eggshell and a glove)
**Duration:** Concentration, up to 1 minute

You create a Large hand of shimmering magical energy in an unoccupied space that you can see within range. The hand lasts for the duration, and it moves at your command, mimicking the movements of your own hand.

The hand is an object that has AC 20 and Hit Points equal to your Hit Point maximum. If it drops to 0 Hit Points, the spell ends. The hand doesn’t occupy its space.

When you cast the spell and as a Bonus Action on your later turns, you can move the hand up to 60 feet and then cause one of the following effects:

**Clenched Fist.** The hand strikes a target within 5 feet of it. Make a melee spell attack. On a hit, the target takes 5d8 Force damage.

**Forceful Hand.** The hand attempts to push a Huge or smaller creature within 5 feet of it. The target must succeed on a Strength saving throw, or the hand pushes the target up to 5 feet plus a number of feet equal to five times your spellcasting ability modifier. The hand moves with the target, remaining within 5 feet of it.

**Grasping Hand.** The hand attempts to grapple a Huge or smaller creature within 5 feet of it. The target must succeed on a Dexterity saving throw, or the target has the Grappled condition, with an escape DC equal to your spell save DC. While the hand grapples the target, you can take a Bonus Action to cause the hand to crush it, dealing Bludgeoning damage to the target equal to 4d6 plus your spellcasting ability modifier.

**Interposing Hand.** The hand grants you Half Cover against attacks and other effects that originate from its space or that pass through it. In addition, its space counts as Difficult Terrain for your enemies.

***Using a Higher-Level Spell Slot.*** The damage of the Clenched Fist increases by 2d8 and the damage of the Grasping Hand increases by 2d6 for each spell slot level above 5.

## Effects
```yaml
- summon: { creature: { text: "Large hand: AC 20, HP equal to your HP maximum" }, control: { activation: bonus, move: 60 } }
- action:
    id: arcane-hand
    activation: bonus
    choose-one:
      - { id: clenched-fist, label: Clenched Fist, attack: { kind: melee-spell }, damage: { dice: 5d8, type: force } }
      - { id: forceful-hand, label: Forceful Hand, save: { ability: str }, move: { target: 5 + 5 * spell-ability, direction: away } }
      - { id: grasping-hand, label: Grasping Hand, save: { ability: dex }, apply: { condition: grappled, escape: { dc: spell:dc } },
          then: { activation: bonus, damage: { dice: 4d6 + spell-ability, type: bludgeoning } } }
      - { id: interposing-hand, label: Interposing Hand, text: "Half Cover for you; its space is Difficult Terrain for enemies." }
- scaling: { per-slot-above: 5, add: { choose-one.clenched-fist.damage: 2d8, choose-one.grasping-hand.then.damage: 2d6 } }
```
