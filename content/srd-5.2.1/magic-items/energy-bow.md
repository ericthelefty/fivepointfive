# Energy Bow
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 220
*Weapon (Longbow or Shortbow), Very Rare (Requires Attunement)*

You gain a +1 bonus to attack rolls and damage rolls made with this magic weapon, which has no string. Each time you pull your arm back in a firing motion, a magical arrow made of golden energy appears nocked and ready to fire. An arrow produced by this weapon deals Force damage instead of Piercing damage on a hit, and it disappears after it hits or misses its target. Until it disappears, the arrow emits Bright Light in a 20-foot radius and Dim Light for an additional 20 feet.

This weapon has the following additional properties.

***Arrow of Restraint.*** Whenever you use this weapon to make a ranged attack against a creature, you can try to restrain the target instead of dealing damage to it. If the arrow hits, the target must succeed on a DC 15 Strength saving throw or have the Restrained condition for 1 minute. As an action, a creature Restrained by an arrow can make a DC 20 Strength (Athletics) check to try to break the restraint, ending the effect on itself on a successful check.

***Arrow of Transport.*** As a Magic action, you can fire one energy arrow from this weapon at a target you can see within 60 feet of yourself. The target can be either a willing Medium or smaller creature or an object that isn’t being worn or carried, provided the object is small enough to fit inside a 5-foot Cube. The arrow teleports the target to an unoccupied space you can see within 10 feet of you.

***Energy Ladder.*** As a Magic action, you can loose a flurry of energy arrows from this weapon at a wall up to 60 feet away from yourself. The arrows become glowing rungs that stick out of the wall, forming a magical ladder up to 60 feet long on the wall. This ladder lasts for 1 minute before disappearing.

## Effects
```yaml
- bonus: { to: [attack, damage], value: 1, scope: { weapon: { id: self } } }
- damage-type: { replace: piercing, with: force, scope: { weapon: { id: self } } }
- trait: [no-ammunition-needed]
- trigger: { event: hit, scope: { weapon: { id: self } }, label: Arrow of Restraint, offer: { instead-of-damage: true, save: { ability: str, dc: 15 },
             on-failure: { apply: { condition: restrained, duration: { amount: 1, unit: minute }, escape: { check: skill:athletics, dc: 20 } } } } }
- action: { id: arrow-of-transport, activation: magic, range: 60, targets: { count: 1, creature: willing, size-max: medium }, move: { teleport-target: 10 } }
- action: { id: energy-ladder, activation: magic, range: 60, duration: { amount: 1, unit: minute }, text: "A 60-foot ladder of glowing rungs on a wall." }
```
