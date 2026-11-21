# Hallow
**Type:** Spell
**Source:** SRD 5.2.1, p. 138
*Level 5 Abjuration (Cleric)*
**Casting Time:** 24 hours
**Range:** Touch
**Components:** V, S, M (incense worth 1,000+ GP, which the spell consumes)
**Duration:** Until dispelled

You touch a point and infuse an area around it with holy or unholy power. The area can have a radius up to 60 feet, and the spell fails if the radius includes an area already under the effect of *Hallow*. The affected area has the following effects.

***Hallowed Ward.*** Choose any of these creature types: Aberration, Celestial, Elemental, Fey, Fiend, or Undead. Creatures of the chosen types can’t willingly enter the area, and any creature that is possessed by or that has the Charmed or Frightened condition from such creatures isn’t possessed, Charmed, or Frightened by them while in the area.

***Extra Effect.*** You bind an extra effect to the area from the list below:

**Courage.** Creatures of any types you choose can’t gain the Frightened condition while in the area.

**Darkness.** Darkness fills the area. Normal light, as well as magical light created by spells of a level lower than this spell, can’t illuminate the area.

**Daylight.** Bright light fills the area. Magical Darkness created by spells of a level lower than this spell can’t extinguish the light.

**Peaceful Rest.** Dead bodies interred in the area can’t be turned into Undead.

**Extradimensional Interference.** Creatures of any types you choose can’t enter or exit the area using teleportation or interplanar travel.

**Fear.** Creatures of any types you choose have the Frightened condition while in the area.

**Resistance.** Creatures of any types you choose have Resistance to one damage type of your choice while in the area.

**Silence.** No sound can emanate from within the area, and no sound can reach into it.

**Tongues.** Creatures of any types you choose can communicate with any other creature in the area even if they don’t share a common language.

**Vulnerability.** Creatures of any types you choose have Vulnerability to one damage type of your choice while in the area.

## Effects
```yaml
- zone:
    area: { shape: sphere, size: 60 }
    choose: { id: hallowed-ward, kind: option, count: any, options: [ { id: aberration }, { id: celestial }, { id: elemental }, { id: fey }, { id: fiend }, { id: undead } ] }
    choose-one:
      - { id: courage, label: Courage, effects: [ { defense: { condition-immunity: [frightened] } } ] }
      - { id: darkness, label: Darkness, effects: [ { trait: [magical-darkness] } ] }
      - { id: daylight, label: Daylight, effects: [ { trait: { light: { bright: fill } } } ] }
      - { id: peaceful-rest, label: Peaceful Rest, text: "Dead bodies can't be turned Undead." }
      - { id: extradimensional, label: Extradimensional Interference, effects: [ { trait: [no-teleport-in, no-planar-travel] } ] }
      - { id: fear, label: Fear, effects: [ { condition: [frightened] } ] }
      - { id: resistance, label: Resistance, choose: { kind: damage-type }, effects: [ { defense: { resistance: [chosen] } } ] }
      - { id: silence, label: Silence, effects: [ { trait: [no-sound-in-or-out] } ] }
      - { id: tongues, label: Tongues, effects: [ { trait: [understood-by-all] } ] }
      - { id: silence, label: Silence, effects: [ { trait: [no-sound-in-or-out] } ] }
      - { id: tongues, label: Tongues, effects: [ { trait: [understood-by-all] } ] }
      - { id: vulnerability, label: Vulnerability, choose: { kind: damage-type }, effects: [ { defense: { vulnerability: [chosen] } } ] }
    text: "Creatures of the warded types can't willingly enter; it frees creatures they've charmed, frightened or possessed."
```
