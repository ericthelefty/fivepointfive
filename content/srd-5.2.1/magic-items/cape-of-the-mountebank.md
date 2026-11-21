# Cape of the Mountebank
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 215
*Wondrous Item, Rare*

This cape smells faintly of brimstone. While wearing it, you can use it to cast *Dimension Door* as a Magic action. This property can’t be used again until the next dawn.

When you teleport with that spell, you leave behind a cloud of smoke. The space you left is Lightly Obscured by that smoke until the end of your next turn.

## Effects
```yaml
- resource: { id: mountebank, max: 1, reset: dawn }
- action: { activation: magic, cost: { resource: $#mountebank }, cast: $srd/spells/dimension-door, text: "Leaves smoke: Lightly Obscured until the end of your next turn." }
```
