# Fog Cloud
**Type:** Spell
**Source:** SRD 5.2.1, p. 133
*Level 1 Conjuration (Druid, Ranger, Sorcerer, Wizard)*
**Casting Time:** Action
**Range:** 120 feet
**Components:** V, S
**Duration:** Concentration, up to 1 hour

You create a 20-foot-radius Sphere of fog centered on a point within range. The Sphere is Heavily Obscured. It lasts for the duration or until a strong wind (such as one created by *Gust of Wind*) disperses it.

***Using a Higher-Level Spell Slot.*** The fog’s radius increases by 20 feet for each spell slot level above 1.

## Effects
```yaml
- zone: { area: { shape: sphere, size: 20 }, effects: [ { trait: [heavily-obscured] } ] }
- scaling: { per-slot-above: 1, add: { area.size: 20 } }
```
