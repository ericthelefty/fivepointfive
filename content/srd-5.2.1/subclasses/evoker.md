# Evoker
**Type:** Subclass
**Parent:** Wizard
**Source:** SRD 5.2.1, p. 82
*Create Explosive Elemental Effects*

Your studies focus on magic that creates powerful elemental effects such as bitter cold, searing flame, rolling thunder, crackling lightning, and burning acid. Some Evokers find employment in military forces, serving as artillery to blast armies from afar. Others use their power to protect others, while some seek their own gain.

## Level 3: Evocation Savant

Choose two Wizard spells from the Evocation school, each of which must be no higher than level 2, and add them to your spellbook for free.

In addition, whenever you gain access to a new level of spell slots in this class, you can add one Wizard spell from the Evocation school to your spellbook for free. The chosen spell must be of a level for which you have spell slots.

## Effects
```yaml
- choose: { id: savant, kind: spell, count: 2, grants: spellbook, from: { spell: { list: wizard, school: evocation, level: [1, 2] } } }
- choose: { id: savant-more, kind: spell, count: 1, grants: spellbook, at: new-slot-level,
            from: { spell: { list: wizard, school: evocation, slot: available } } }
```

## Level 3: Potent Cantrip

Your damaging cantrips affect even creatures that avoid the brunt of the effect. When you cast a cantrip at a creature and you miss with the attack roll or the target succeeds on a saving throw against the cantrip, the target takes half the cantrip’s damage (if any) but suffers no additional effect from the cantrip.

## Effects
```yaml
- save-rule: { scope: { spell: { level: 0 } }, success: half, miss: half, text: "No additional effect on a miss or successful save." }
```

## Level 6: Sculpt Spells

You can create pockets of relative safety within the effects of your evocations. When you cast an Evocation spell that affects other creatures that you can see, you can choose a number of them equal to 1 plus the spell’s level. The chosen creatures automatically succeed on their saving throws against the spell, and they take no damage if they would normally take half damage on a successful save.

## Effects
```yaml
- trigger: { event: cast, scope: { spell: { school: evocation } },
             offer: { text: "Up to 1 + spell level creatures you can see auto-succeed on the save and take no damage on a half-on-success save." } }
```

## Level 10: Empowered Evocation

Whenever you cast a Wizard spell from the Evocation school, you can add your Intelligence modifier to one damage roll of that spell.

## Effects
```yaml
- bonus: { to: damage, value: mod:int, once: true, scope: { spell: { list: wizard, school: evocation } } }
```

## Level 14: Overchannel

You can increase the power of your spells. When you cast a Wizard spell with a spell slot of levels 1–5 that deals damage, you can deal maximum damage with that spell on the turn you cast it.

The first time you do so, you suffer no adverse effect. If you use this feature again before you finish a Long Rest, you take 2d12 Necrotic damage for each level of the spell slot immediately after you cast it. This damage ignores Resistance and Immunity.

Each time you use this feature again before finishing a Long Rest, the Necrotic damage per spell level increases by 1d12.

## Effects
```yaml
- trigger:
    event: cast
    scope: { spell: { list: wizard, slot: [1, 2, 3, 4, 5], deals: any } }
    counter: { reset: long }
    offer:
      maximize: true
      self-damage: { if: "uses >= 1", dice: "dice((uses + 1) * slot-level, d12)", type: necrotic, ignore: [resistance, immunity] }
```
