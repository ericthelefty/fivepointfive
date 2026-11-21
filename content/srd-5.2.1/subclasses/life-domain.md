# Life Domain
**Type:** Subclass
**Parent:** Cleric
**Source:** SRD 5.2.1, p. 40
*Soothe the Hurts of the World*

The Life Domain focuses on the positive energy that helps sustain all life in the multiverse. Clerics who tap into this domain are masters of healing, using that life force to cure many hurts.

Existence itself relies on the positive energy associated with this domain, so a Cleric of almost any religious tradition might choose it. This domain is particularly associated with agricultural deities, gods of healing or endurance, and gods of home and community. Religious orders of healing also seek the magic of this domain.

## Level 3: Disciple of Life

When a spell you cast with a spell slot restores Hit Points to a creature, that creature regains additional Hit Points on the turn you cast the spell. The additional Hit Points equal 2 plus the spell slot’s level.

## Effects
```yaml
- bonus: { to: healing, value: 2 + slot-level, scope: { spell: { slot: true, heals: true } } }
```

## Level 3: Life Domain Spells

Your connection to this divine domain ensures you always have certain spells ready. When you reach a Cleric level specified in the Life Domain Spells table, you thereafter always have the listed spells prepared.

## Effects
```yaml
- spell-list: { prepared: always, by-level: {
    3: [$srd/spells/aid, $srd/spells/bless, $srd/spells/cure-wounds, $srd/spells/lesser-restoration],
    5: [$srd/spells/mass-healing-word, $srd/spells/revivify],
    7: [$srd/spells/aura-of-life, $srd/spells/death-ward],
    9: [$srd/spells/greater-restoration, $srd/spells/mass-cure-wounds] } }
```

### Life Domain Spells

| Cleric Level | Prepared Spells |
|---|---|
| 3 | Aid, Bless, Cure Wounds, |
|  | Lesser Restoration |
| 5 | Mass Healing Word, Revivify |
| 7 | Aura of Life, Death Ward |
| 9 | Greater Restoration, Mass Cure Wounds |

## Level 3: Preserve Life

As a Magic action, you present your Holy Symbol and expend a use of your Channel Divinity to evoke healing energy that can restore a number of Hit Points equal to five times your Cleric level. Choose Bloodied creatures within 30 feet of yourself (which can include you), and divide those Hit Points among them. This feature can restore a creature to no more than half its Hit Point maximum.

## Effects
```yaml
- action:
    id: preserve-life
    activation: magic
    cost: { resource: $srd/cleric#channel-divinity }
    area: { shape: emanation, size: 30 }
    targets: { condition: bloodied, include-self: true }
    heal: 5 * level:cleric
    text: "Divide the healing among the chosen creatures; no creature above half its Hit Point maximum."
```

## Level 6: Blessed Healer

The healing spells you cast on others heal you as well. Immediately after you cast a spell with a spell slot that restores Hit Points to one or more creatures other than yourself, you regain Hit Points equal to 2 plus the spell slot’s level.

## Effects
```yaml
- trigger: { event: cast, scope: { spell: { slot: true, heals: true } }, if: "The spell healed a creature other than you",
             offer: { heal: 2 + slot-level, text: "You regain these Hit Points" } }
```

## Level 17: Supreme Healing

When you would normally roll one or more dice to restore Hit Points to a creature with a spell or Channel Divinity, don’t roll those dice for the healing; instead use the highest number possible for each die. For example, instead of restoring 2d6 Hit Points to a creature with a spell, you restore 12.

## Effects
```yaml
- maximize: { scope: { any: [ { spell: { heals: true } }, { source: $srd/cleric#channel-divinity } ] } }
```
