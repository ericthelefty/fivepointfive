# Finger of Death
**Type:** Spell
**Source:** SRD 5.2.1, p. 131
*Level 7 Necromancy (Sorcerer, Warlock, Wizard)*
**Casting Time:** Action
**Range:** 60 feet
**Components:** V, S
**Duration:** Instantaneous

You unleash negative energy toward a creature you can see within range. The target makes a Constitution saving throw, taking 7d8 + 30 Necrotic damage on a failed save or half as much damage on a successful one.

A Humanoid killed by this spell rises at the start of your next turn as a **Zombie** (see “Monsters”) that follows your verbal orders.

## Effects
```yaml
- action: { targets: { count: 1 }, save: { ability: con, success: half }, damage: { dice: 7d8 + 30, type: necrotic },
            text: "A Humanoid killed by it rises as a Zombie under your orders." }
```
