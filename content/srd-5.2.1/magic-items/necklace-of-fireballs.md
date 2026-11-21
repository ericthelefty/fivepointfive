# Necklace of Fireballs
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 233
*Wondrous Item, Rare*

This necklace has 1d6 + 3 beads hanging from it. You can take a Magic action to detach a bead and throw it up to 60 feet away. When it reaches the end of its trajectory, the bead detonates as a level 3 *Fireball* (save DC 15).

You can hurl multiple beads, or even the whole necklace, at one time. When you do so, increase the damage of the *Fireball* by 1d6 for each bead after the first (maximum 12d6).

## Effects
```yaml
- charges: { max: 1d6 + 3, start: 1d6 + 3, destroy-on: { when: last-charge } }
- action: { activation: magic, cost: { charges: { min: 1 } }, cast: $srd/spells/fireball, cast-at: 3, overrides: { dc: 15 },
            text: "+1d6 damage per extra bead thrown (max 12d6)." }
```
