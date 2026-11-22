# Hunting Trap
**Type:** Gear
**Cost:** 5 GP
**Weight:** 25 lb.
**Source:** SRD 5.2.1, p. 97

As a Utilize action, you can set a Hunting Trap, which is a sawtooth steel ring that snaps shut when a creature steps on a pressure plate in the center. The trap is affixed by a heavy chain to an immobile object, such as a tree or a spike driven into the ground. A creature that steps on the plate must succeed on a DC 13 Dexterity saving throw or take 1d4 Piercing damage and have its Speed reduced to 0 until the start of its next turn. Thereafter, until the creature breaks free of the trap, its movement is limited by the length of the chain (typically 3 feet). A creature can use its action to make a DC 13 Strength (Athletics) check, freeing itself or another creature within its reach on a success. Each failed check deals 1 Piercing damage to the trapped creature.

## Effects
```yaml
- action: { activation: utilize, zone: { area: { shape: square, size: 5 }, event: [enter-area], save: { ability: dex, dc: 13 },
            on-failure: { damage: { dice: 1d4, type: piercing }, apply: { text: "Speed 0, then held by the chain", escape: { check: skill:athletics, dc: 13, on-failure: { damage: { dice: 1, type: piercing } } } } } } }
```
