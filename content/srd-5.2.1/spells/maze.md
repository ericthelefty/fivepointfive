# Maze
**Type:** Spell
**Source:** SRD 5.2.1, p. 148
*Level 8 Conjuration (Wizard)*
**Casting Time:** Action
**Range:** 60 feet
**Components:** V, S
**Duration:** Concentration, up to 10 minutes

You banish a creature that you can see within range into a labyrinthine demiplane. The target remains there for the duration or until it escapes the maze.

The target can take a Study action to try to escape. When it does so, it makes a DC 20 Intelligence (Investigation) check. If it succeeds, it escapes, and the spell ends.

When the spell ends, the target reappears in the space it left or, if that space is occupied, in the nearest unoccupied space.

## Effects
```yaml
- action: { targets: { count: 1 }, apply: { text: "Banished into a maze", duration: spell, escape: { activation: study, check: skill:investigation, dc: 20, ability: int } } }
```
