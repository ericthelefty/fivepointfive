# Reverse Gravity
**Type:** Spell
**Source:** SRD 5.2.1, p. 159
*Level 7 Transmutation (Druid, Sorcerer, Wizard)*
**Casting Time:** Action
**Range:** 100 feet
**Components:** V, S, M (a lodestone and iron filings)
**Duration:** Concentration, up to 1 minute

This spell reverses gravity in a 50-foot-radius, 100-foot high Cylinder centered on a point within range. All creatures and objects in that area that aren’t anchored to the ground fall upward and reach the top of the Cylinder. A creature can make a Dexterity saving throw to grab a fixed object it can reach, thus avoiding the fall upward.

If a ceiling or an anchored object is encountered in this upward fall, creatures and objects strike it just as they would during a downward fall. If an affected creature or object reaches the Cylinder’s top without striking anything, it hovers there for the duration. When the spell ends, affected objects and creatures fall downward.

## Effects
```yaml
- zone: { area: { shape: cylinder, size: 50, height: 100 }, event: [cast, enter-area], save: { ability: dex, text: "To grab a fixed object" },
          on-failure: { text: "Falls upward (falling damage if it strikes something) and hovers at the top." } }
```
