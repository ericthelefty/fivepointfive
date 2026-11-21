# Tinker’s Tools
**Type:** Tool
**Cost:** 50 GP
**Source:** SRD 5.2.1, p. 94
**Ability:** Dexterity
**Weight:** 10 lb.
**Utilize:** Assemble a Tiny item composed of scrap, which falls apart in 1 minute (DC 20)
**Craft:** Musket, Pistol, Bell, Bullseye Lantern, Flask, Hooded Lantern, Hunting Trap, Lock, Manacles, Mirror, Shovel, Signal Whistle, Tinderbox

## Effects
```yaml
- action:
    activation: utilize
    label: Which falls apart in 1 minute
    check: {tool: self, ability: dex, dc: 20}
- craft:
    items: [musket, pistol, bell, bullseye-lantern, flask, hooded-lantern, hunting-trap, lock, manacles, mirror, shovel, signal-whistle, tinderbox]
```
