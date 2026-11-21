# Spiritual Weapon
**Type:** Spell
**Source:** SRD 5.2.1, p. 165
*Level 2 Evocation (Cleric)*
**Casting Time:** Bonus Action
**Range:** 60 feet
**Components:** V, S
**Duration:** Concentration, up to 1 minute

You create a floating, spectral force that resembles a weapon of your choice and lasts for the duration. The force appears within range in a space of your choice, and you can immediately make one melee spell attack against one creature within 5 feet of the force. On a hit, the target takes Force damage equal to 1d8 plus your spellcasting ability modifier.

As a Bonus Action on your later turns, you can move the force up to 20 feet and repeat the attack against a creature within 5 feet of it.

***Using a Higher-Level Spell Slot.*** The damage increases by 1d8 for every slot level above 2.

## Effects
```yaml
- action: { attack: { kind: melee-spell }, damage: { dice: 1d8 + spell-ability, type: force }, repeat: { activation: bonus, move: 20 } }
- scaling: { per-slot-above: 2, add: { damage: 1d8 } }
```
