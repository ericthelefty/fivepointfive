# Pass without Trace
**Type:** Spell
**Source:** SRD 5.2.1, p. 151
*Level 2 Abjuration (Druid, Ranger)*
**Casting Time:** Action
**Range:** Self
**Components:** V, S, M (ashes from burned mistletoe)
**Duration:** Concentration, up to 1 hour

You radiate a concealing aura in a 30-foot Emanation for the duration. While in the aura, you and each creature you choose have a +10 bonus to Dexterity (Stealth) checks and leave no tracks.

## Effects
```yaml
- aura: { id: pass-without-trace, area: { shape: emanation, size: 30 }, affects: [self, chosen],
          effects: [ { bonus: { to: skill:stealth, value: 10 } }, { trait: [leaves-no-tracks] } ] }
```
