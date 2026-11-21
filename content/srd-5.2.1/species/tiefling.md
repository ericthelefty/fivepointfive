# Tiefling
**Type:** Species
**Source:** SRD 5.2.1, p. 86
**Creature Type:** Humanoid
**Size:** Medium (about 4–7 feet tall) or Small (about 3–4 feet tall), chosen when you select this species
**Speed:** 30 feet

As a Tiefling, you have the following special traits.

## Effects
```yaml
- choose: { id: size, kind: size, count: 1, from: [medium, small] }
```

## Darkvision

You have Darkvision with a range of 60 feet.

## Effects
```yaml
- sense: { darkvision: 60 }
```

## Fiendish Legacy

You are the recipient of a legacy that grants you supernatural abilities. Choose a legacy from the Fiendish Legacies table. You gain the level 1 benefit of the chosen legacy.

When you reach character levels 3 and 5, you learn a higher-level spell, as shown on the table. You always have that spell prepared. You can cast it once without a spell slot, and you regain the ability to cast it in that way when you finish a Long Rest. You can also cast the spell using any spell slots you have of the appropriate level.

Intelligence, Wisdom, or Charisma is your spellcasting ability for the spells you cast with this trait (choose the ability when you select the legacy).

## Effects
```yaml
- choose: { id: legacy-ability, kind: ability, count: 1, from: [int, wis, cha] }
- choose:
    id: legacy
    kind: option
    options:
      - id: abyssal
        label: Abyssal
        effects:
          - defense: { resistance: [poison] }
          - grant-spell: { spell: $srd/spells/poison-spray, ability: choice:legacy-ability }
          - grant-spell: { spell: $srd/spells/ray-of-sickness, level: 3, prepared: always, free: { per: long, count: 1 }, ability: choice:legacy-ability }
          - grant-spell: { spell: $srd/spells/hold-person, level: 5, prepared: always, free: { per: long, count: 1 }, ability: choice:legacy-ability }
      - id: chthonic
        label: Chthonic
        effects:
          - defense: { resistance: [necrotic] }
          - grant-spell: { spell: $srd/spells/chill-touch, ability: choice:legacy-ability }
          - grant-spell: { spell: $srd/spells/false-life, level: 3, prepared: always, free: { per: long, count: 1 }, ability: choice:legacy-ability }
          - grant-spell: { spell: $srd/spells/ray-of-enfeeblement, level: 5, prepared: always, free: { per: long, count: 1 }, ability: choice:legacy-ability }
      - id: infernal
        label: Infernal
        effects:
          - defense: { resistance: [fire] }
          - grant-spell: { spell: $srd/spells/fire-bolt, ability: choice:legacy-ability }
          - grant-spell: { spell: $srd/spells/hellish-rebuke, level: 3, prepared: always, free: { per: long, count: 1 }, ability: choice:legacy-ability }
          - grant-spell: { spell: $srd/spells/darkness, level: 5, prepared: always, free: { per: long, count: 1 }, ability: choice:legacy-ability }
```

## Otherworldly Presence

You know the *Thaumaturgy* cantrip. When you cast it with this trait, the spell uses the same spellcasting ability you use for your Fiendish Legacy trait.

## Effects
```yaml
- grant-spell: { spell: $srd/spells/thaumaturgy, ability: choice:legacy-ability }
```

## Fiendish Legacies

| Legacy | Level 1 | Level 3 | Level 5 |
|---|---|---|---|
| Abyssal | You have Resistance to Poison damage. You also know the Poison Spray cantrip. | Ray of Sickness | Hold Person |
| Chthonic | You have Resistance to Necrotic damage. You also know the Chill Touch cantrip. | False Life | Ray of Enfeeblement |
| Infernal | You have Resistance to Fire damage. You also know the Fire Bolt cantrip. | Hellish Rebuke | Darkness |
