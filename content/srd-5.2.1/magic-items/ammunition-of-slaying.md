# Ammunition of Slaying
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 209
*Weapon (Any Ammunition), Very Rare*

This magic ammunition is meant to slay creatures of a particular type, which the GM chooses or determines randomly by rolling on the table below. If a creature of that type takes damage from the ammunition, the creature makes a DC 17 Constitution saving throw, taking an extra 6d10 Force damage on a failed save or half as much extra damage on a successful one.

After dealing its extra damage to a creature, the ammunition becomes nonmagical.

|  |  |  |  |
|---|---|---|---|
| 1d100 | Creature Type | 1d100 | Creature Type |
| 01–10 | Aberrations | 51–60 | Fey |
| 11–15 | Beasts | 61–70 | Fiends |
| 16–20 | Celestials | 71–75 | Giants |
| 21–25 | Constructs | 76–80 | Monstrosities |
| 26–35 | Dragons | 81–85 | Oozes |
| 36–45 | Elementals | 86–90 | Plants |
| 46–50 | Humanoids | 91–00 | Undead |

## Effects
```yaml
- variant: { id: slays, by: roll, roll: 1d100, table: Ammunition of Slaying }
- trigger: { event: hit, scope: { weapon: { id: self }, against: { creature: variant:slays } }, auto: true,
             offer: { save: { ability: con, dc: 17, success: half }, damage: { dice: 6d10, type: force }, consume: self } }
```
