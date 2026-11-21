# Sun Blade
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 248
*Weapon (Longsword), Rare (Requires Attunement)*

This item appears to be a sword hilt.

***Blade of Radiance.*** While grasping the hilt, you can take a Bonus Action to cause a blade of pure radiance to spring into existence or make the blade disappear. While the blade exists, this magic weapon functions as a Longsword with the Finesse property. If you are proficient with Longswords or Shortswords, you are proficient with the *Sun Blade.*

You gain a +2 bonus to attack rolls and damage rolls made with this weapon, which deals Radiant damage instead of Slashing damage. When you hit an Undead with it, that target takes an extra 1d8 Radiant damage.

***Sunlight.*** The sword’s luminous blade emits Bright Light in a 15-foot radius and Dim Light for an additional 15 feet. The light is sunlight. While the blade persists, you can take a Magic action to expand or reduce its radius of Bright Light and Dim Light by 5 feet each, to a maximum of 30 feet each or a minimum of 10 feet each.

## Effects
```yaml
- toggle: { activation: bonus, effects: [
    { bonus: { to: [attack, damage], value: 2, scope: { weapon: { id: self } } } },
    { weapon-property: { add: [finesse] } },
    { damage-type: { replace: slashing, with: radiant, scope: { weapon: { id: self } } } },
    { trigger: { event: hit, scope: { weapon: { id: self }, against: { creature: undead } }, auto: true, offer: { damage: { dice: 1d8, type: radiant } } } },
    { trait: { light: { bright: 15, dim: 15, sunlight: true } } } ] }
- proficiency: [{ weapon: { id: self, if-proficient: [longsword, shortsword] } }]
- action: { activation: magic, text: "Change the Bright and Dim Light radius by 5 feet each (10 to 30 feet)." }
```
