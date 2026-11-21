# Iron Bands
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 228
*Wondrous Item, Rare*

This rusty iron sphere measures 3 inches in diameter and weighs 1 pound. You can take a Magic action to throw the sphere at a Huge or smaller creature you can see within 60 feet of yourself. As the sphere moves through the air, it opens into a tangle of metal bands.

Make a ranged attack roll with an attack bonus equal to your Dexterity modifier plus your Proficiency Bonus. On a hit, the target has the Restrained condition until you take a Bonus Action to issue a command that releases it. Doing so or missing with the attack causes the bands to contract and become a sphere once more.

A creature that can touch the bands, including the one Restrained, can take an action to make a DC 20 Strength (Athletics) check to break the iron bands. On a successful check, the item is destroyed, and the Restrained creature is freed. On a failed check, any further attempts made by that creature automatically fail until 24 hours have elapsed.

Once the bands are used, they can’t be used again until the next dawn.

## Effects
```yaml
- resource: { id: iron-bands, max: 1, reset: dawn }
- action: { activation: magic, cost: { resource: $#iron-bands }, range: 60, targets: { count: 1, size-max: huge }, attack: { kind: ranged, bonus: mod:dex + prof },
            on-hit: { apply: { condition: restrained, escape: { check: skill:athletics, dc: 20 }, text: "Until you release it (Bonus Action)" } } }
```
