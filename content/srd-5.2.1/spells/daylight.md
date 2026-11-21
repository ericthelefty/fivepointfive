# Daylight
**Type:** Spell
**Source:** SRD 5.2.1, p. 122
*Level 3 Evocation (Cleric, Druid, Paladin, Ranger, Sorcerer)*
**Casting Time:** Action
**Range:** 60 feet
**Components:** V, S
**Duration:** 1 hour

For the duration, sunlight spreads from a point within range and fills a 60-foot-radius Sphere. The sunlight’s area is Bright Light and sheds Dim Light for an additional 60 feet.

Alternatively, you cast the spell on an object that isn’t being worn or carried, causing the sunlight to fill a 60-foot Emanation originating from that object. Covering that object with something opaque, such as a bowl or helm, blocks the sunlight.

If any of this spell’s area overlaps with an area of Darkness created by a spell of level 3 or lower, that other spell is dispelled.

## Effects
```yaml
- zone: { area: { choose-on-use: [ { shape: sphere, size: 60 }, { shape: emanation, size: 60, from: object } ] },
          effects: [ { trait: { light: { bright: sunlight, dim: 60 } } } ], text: "Dispels Darkness spells of level 3 or lower it overlaps." }
```
