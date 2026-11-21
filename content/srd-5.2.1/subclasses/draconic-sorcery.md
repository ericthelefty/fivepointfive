# Draconic Sorcery
**Type:** Subclass
**Parent:** Sorcerer
**Source:** SRD 5.2.1, p. 69
*Breathe the Magic of Dragons*

Your innate magic comes from the gift of a dragon. Perhaps an ancient dragon facing death bequeathed some of its magical power to you or your ancestor. You might have absorbed magic from a site infused with dragons’ power. Or perhaps you handled a treasure taken from a dragon’s hoard that was steeped in draconic power. Or you might have a dragon for an ancestor.

## Level 3: Draconic Resilience

The magic in your body manifests physical traits of your draconic gift. Your Hit Point maximum increases by 3, and it increases by 1 whenever you gain another Sorcerer level.

Parts of you are also covered by dragon-like scales. While you aren’t wearing armor, your base Armor Class equals 10 plus your Dexterity and Charisma modifiers.

## Effects
```yaml
- bonus: { to: hp:max, value: level:sorcerer }
- base: { to: ac, value: 10 + mod:dex + mod:cha, when: { armor: none }, allow-shield: true }
```

## Level 3: Draconic Spells

When you reach a Sorcerer level specified in the Draconic Spells table, you thereafter always have the listed spells prepared.

## Effects
```yaml
- spell-list: { prepared: always, by-level: {
    3: [$srd/spells/alter-self, $srd/spells/chromatic-orb, $srd/spells/command, $srd/spells/dragons-breath],
    5: [$srd/spells/fear, $srd/spells/fly],
    7: [$srd/spells/arcane-eye, $srd/spells/charm-monster],
    9: [$srd/spells/legend-lore, $srd/spells/summon-dragon] } }
```

### Draconic Spells

| Sorcerer Level | Spells |
|---|---|
| 3 | Alter Self, Chromatic Orb, Command, |
|  | Dragon’s Breath |
| 5 | Fear, Fly |
| 7 | Arcane Eye, Charm Monster |
| 9 | Legend Lore, Summon Dragon |

## Level 6: Elemental Affinity

Your draconic magic has an affinity with a damage type associated with dragons. Choose one of those types: Acid, Cold, Fire, Lightning, or Poison.

You have Resistance to that damage type, and when you cast a spell that deals damage of that type, you can add your Charisma modifier to one damage roll of that spell.

## Effects
```yaml
- choose: { id: affinity, kind: damage-type, count: 1, from: [acid, cold, fire, lightning, poison] }
- defense: { resistance: [choice:affinity] }
- bonus: { to: damage, value: mod:cha, once: true, scope: { spell: { deals: choice:affinity } } }
```

## Level 14: Dragon Wings

As a Bonus Action, you can cause draconic wings to appear on your back. The wings last for 1 hour or until you dismiss them (no action required). For the duration, you have a Fly Speed of 60 feet.

Once you use this feature, you can’t use it again until you finish a Long Rest unless you spend 3 Sorcery Points (no action required) to restore your use of it.

## Effects
```yaml
- resource: { id: dragon-wings, max: 1, reset: long }
- convert: { from: { resource: $srd/sorcerer#sorcery-points, amount: 3 }, to: { resource: $#dragon-wings, amount: 1 }, activation: none, if-empty: true }
- toggle:
    id: dragon-wings
    activation: bonus
    cost: { resource: $#dragon-wings }
    duration: { amount: 1, unit: hour }
    effects:
      - speed: { fly: 60 }
```

## Level 18: Dragon Companion

You can cast *Summon Dragon* without a Material component. You can also cast it once without a spell slot, and you regain the ability to cast it in this way when you finish a Long Rest.

Whenever you start casting the spell, you can modify it so that it doesn’t require Concentration. If you do so, the spell’s duration becomes 1 minute for that casting.

## Effects
```yaml
- grant-spell: { spell: $srd/spells/summon-dragon, free: { per: long, count: 1 },
                 overrides: { components.material: false, concentration: { optional: true, if-dropped: { duration: { amount: 1, unit: minute } } } } }
```
