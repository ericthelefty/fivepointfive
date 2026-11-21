# Antimagic Field
**Type:** Spell
**Source:** SRD 5.2.1, p. 109
*Level 8 Abjuration (Cleric, Wizard)*
**Casting Time:** Action
**Range:** Self
**Components:** V, S, M (iron filings)
**Duration:** Concentration, up to 1 hour

An aura of antimagic surrounds you in 10-foot Emanation. No one can cast spells, take Magic actions, or create other magical effects inside the aura, and those things can’t target or otherwise affect anything inside it. Magical properties of magic items don’t work inside the aura or on anything inside it.

Areas of effect created by spells or other magic can’t extend into the aura, and no one can teleport into or out of it or use planar travel there. Portals close temporarily while in the aura.

Ongoing spells, except those cast by an Artifact or a deity, are suppressed in the area. While an effect is suppressed, it doesn’t function, but the time it spends suppressed counts against its duration.

*Dispel Magic* has no effect on the aura, and the auras created by different *Antimagic Field* spells don’t nullify each other.

## Effects
```yaml
- aura: { id: antimagic-field, area: { shape: emanation, size: 10 }, affects: [all],
          effects: [ { suppress: { target: magic } } ],
          text: "No spells, Magic actions or magical effects in or into the area; magic items stop working; no teleportation in or out." }
```
