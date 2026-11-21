# Circle of the Land
**Type:** Subclass
**Parent:** Druid
**Source:** SRD 5.2.1, p. 46
*Celebrate Connection to the Natural World*

The Circle of the Land comprises mystics and sages who safeguard ancient knowledge and rites. These Druids meet within sacred circles of trees or standing stones to whisper primal secrets in Druidic. The circle’s wisest members preside as the chief priests of their communities.

## Level 3: Circle of the Land Spells

Whenever you finish a Long Rest, choose one type of land: arid, polar, temperate, or tropical. Consult the table below that corresponds to the chosen type; you have the spells listed for your Druid level and lower prepared.

## Effects
```yaml
- choose:
    id: land
    kind: option
    swap: { at: long, count: all }
    options:
      - { id: arid,      label: Arid,      resistance: fire,
          spells: { 3: [$srd/spells/blur, $srd/spells/burning-hands, $srd/spells/fire-bolt], 5: [$srd/spells/fireball],
                    7: [$srd/spells/blight], 9: [$srd/spells/wall-of-stone] } }
      - { id: polar,     label: Polar,     resistance: cold,
          spells: { 3: [$srd/spells/fog-cloud, $srd/spells/hold-person, $srd/spells/ray-of-frost], 5: [$srd/spells/sleet-storm],
                    7: [$srd/spells/ice-storm], 9: [$srd/spells/cone-of-cold] } }
      - { id: temperate, label: Temperate, resistance: lightning,
          spells: { 3: [$srd/spells/misty-step, $srd/spells/shocking-grasp, $srd/spells/sleep], 5: [$srd/spells/lightning-bolt],
                    7: [$srd/spells/freedom-of-movement], 9: [$srd/spells/tree-stride] } }
      - { id: tropical,  label: Tropical,  resistance: poison,
          spells: { 3: [$srd/spells/acid-splash, $srd/spells/ray-of-sickness, $srd/spells/web], 5: [$srd/spells/stinking-cloud],
                    7: [$srd/spells/polymorph], 9: [$srd/spells/insect-plague] } }
- spell-list: { id: circle-spells, prepared: always, by-level: choice:land.spells }
```

### Arid Land

| Druid Level | Circle Spells |
|---|---|
| 3 | Blur, Burning Hands, Fire Bolt |
| 5 | Fireball |
| 7 | Blight |
| 9 | Wall of Stone |

### Polar Land

| Druid Level | Circle Spells |
|---|---|
| 3 | Fog Cloud, Hold Person, Ray of Frost |
| 5 | Sleet Storm |
| 7 | Ice Storm |
| 9 | Cone of Cold |

### Temperate Land

| Druid Level | Circle Spells |
|---|---|
| 3 | Misty Step, Shocking Grasp, Sleep |
| 5 | Lightning Bolt |
| 7 | Freedom of Movement |
| 9 | Tree Stride |

### Tropical Land

| Druid Level | Circle Spells |
|---|---|
| 3 | Acid Splash, Ray of Sickness, Web |
| 5 | Stinking Cloud |
| 7 | Polymorph |
| 9 | Insect Plague |

## Level 3: Land’s Aid

As a Magic action, you can expend a use of your Wild Shape and choose a point within 60 feet of yourself. Vitality-giving flowers and life-draining thorns appear for a moment in a 10-foot-radius Sphere centered on that point. Each creature of your choice in the Sphere must make a Constitution saving throw against your spell save DC, taking 2d6 Necrotic damage on a failed save or half as much damage on a successful one. One creature of your choice in that area regains 2d6 Hit Points.

The damage and healing increase by 1d6 when you reach Druid levels 10 (3d6) and 14 (4d6).

## Effects
```yaml
- action:
    id: lands-aid
    activation: magic
    cost: { resource: $srd/druid#wild-shape }
    range: 60
    area: { shape: sphere, size: 10 }
    save: { ability: con, dc: spell:dc, success: half }
    damage: { dice: "steps(3: 2d6, 10: 3d6, 14: 4d6)", type: necrotic }
    heal: "steps(3: 2d6, 10: 3d6, 14: 4d6)"
    text: "Damage: creatures of your choice in the area. Healing: one creature of your choice in the area."
```

## Level 6: Natural Recovery

You can cast one of the level 1+ spells that you have prepared from your Circle Spells feature without expending a spell slot, and you must finish a Long Rest before you do so again.

In addition, when you finish a Short Rest, you can choose expended spell slots to recover. The spell slots can have a combined level that is equal to or less than half your Druid level (round up), and none of them can be level 6+. For example, if you’re a level 6 Druid, you can recover up to three levels’ worth of spell slots. You can recover a level 3 spell slot, a level 2 and a level 1 spell slot, or three level 1 spell slots. Once you recover spell slots with this feature, you can’t do so again until you finish a Long Rest.

## Effects
```yaml
- grant-spell: { choose: { id: recovery-spell, count: 1, from: { spell: { in: $#circle-spells, level: ">= 1" } }, at-use: true },
                 free: { per: long, count: 1 } }
- trigger: { event: { rest: short }, per: long,
             offer: { regain: { resource: spell-slots, levels: "ceil(level:druid / 2)", max-slot: 5 } } }
```

## Level 10: Nature’s Ward

You are immune to the Poisoned condition, and you have Resistance to a damage type associated with your current land choice in the Circle Spells feature, as shown in the Nature’s Ward table.

## Effects
```yaml
- defense: { condition-immunity: [poisoned], resistance: [choice:land.resistance] }
```

### Nature’s Ward

| Land Type | Resistance | Land Type | Resistance |
|---|---|---|---|
| Arid | Fire | Temperate | Lightning |
| Polar | Cold | Tropical | Poison |

## Level 14: Nature’s Sanctuary

As a Magic action, you can expend a use of your Wild Shape and cause spectral trees and vines to appear in a 15-foot Cube on the ground within 120 feet of yourself. They last there for 1 minute or until you have the Incapacitated condition or die. You and your allies have Half Cover while in that area, and your allies gain the current Resistance of your Nature’s Ward while there.

As a Bonus Action, you can move the Cube up to 60 feet to ground within 120 feet of yourself.

## Effects
```yaml
- action:
    id: natures-sanctuary
    activation: magic
    cost: { resource: $srd/druid#wild-shape }
    range: 120
    area: { shape: cube, size: 15 }
    duration: { amount: 1, unit: minute }
    text: "You and allies have Half Cover in the area; allies gain your Nature's Ward resistance there. Bonus Action: move the Cube up to 60 feet. Ends early if you're Incapacitated or die."
```
