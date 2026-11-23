# Changelog

What changed in each version of fivepointfive. The newest version is first, and its number matches `version` in `package.json` and the status line in the README.

If you run your own instance, check the **Database** line of each version: when it lists a migration, run that file in your Supabase SQL Editor after you update (see [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md#updating-your-instance)).

## Unreleased

- **Database:** `supabase/migrations/0003_encounters.sql`, then `0004_live_characters.sql`.
- Encounters, for the DM (the admin on an instance): build a fight from the Library's monsters and your characters, with its difficulty under the 2024 XP budget, then run it. The tracker keeps initiative order, the round and whose turn it is, HP and conditions for everyone in one place, and clickable stat blocks with a roll log. Characters' HP and conditions stay linked to their sheets.
- Live characters: a change made anywhere (the DM's tracker, the same character open on another device or tab) shows up on every open sheet within a second or two. When two people change a character at once, both changes are kept: HP changes add up, conditions and game log entries combine. Before, an open sheet only picked up changes after a reload, and saving from it could undo them.
- Adding or removing a condition from the encounter tracker puts a line in the character's game log.
- New look for the play sheet ("Forged"): each kind of number has its own frame. Armor Class sits in a shield, initiative, speed, proficiency and passive Perception in notched plates, the spell save DC in a gem, and each ability's modifier in a cut-corner tile with the score in a round rivet below it. Hit points get a gold frame with Heal, the amount and Damage stacked on the left. Skill and save proficiency marks are diamonds: filled for proficient, ringed for expertise, half-filled for half proficiency.
- On phones, Hit points now come right after AC and the other stats by default (Layout still lets you move them).
- On laptops and desktops the six ability scores sit in one row under AC and the other stats, and the tiles are shorter, so the stats, abilities and hit points fit on one screen.
- Game log: attack and damage rolls show the dice and the modifier beside the total (for example 13 + 6), and the newest total pops to twice its size for a moment.
- 3D dice: the roll's modifier lands beside the dice, slanted at a different random angle every roll, in a gold that suits the light or dark theme.
- With 3D dice on, a roll's game log card shows three dots appearing one at a time until the modifier appears beside the dice, then shows the total at the same moment (a critical hit's flash waits too), so the log doesn't give the result away first.
- The game log's dice buttons (d4 to d100) and typed rolls like 2d6+3 roll the 3D dice too, with the modifier beside them.
- Features like Pact Magic, Lay On Hands and Bardic Inspiration no longer show the class's whole 20-level table (the SRD prints it inside them). The sheet and builder show one line with your row instead, e.g. "At Bard level 6: Bardic Die D8 · Cantrips 3 · Prepared Spells 10 · Spell Slots L1 ×4, L2 ×3, L3 ×3".
- Hit points moved to the top of the right-hand column, above the roll bar, in a smaller box. On phones and tablets they still follow the stats.
- Edit in builder (and the "choices left" tag) sits right next to the character's name.
- Tidier roll bar: advantage, normal and disadvantage across the top; the next-roll bonus with Heroic Inspiration, 3D dice and dice sound as small icon toggles beside it. It takes about half the height.
- Short rest and Long rest moved to the top of the sheet, on the line with the character's name.
- On tablets the six ability scores stay in one row, and the hit dice sit beside the Heal and Damage buttons instead of on a row of their own.

## 0.3.0 (2026-11-22)

- **Database:** no new migration.
- Modif effects engine: classes, subclasses, species, backgrounds, feats, spells and magic items in the SRD apply their rules on the sheet automatically, and imported packs can do the same.
- Inventory with equipping, attunement, coins and carrying capacity.
- Multiclass characters, including spell slots, Pact Magic and subclass spellcasting.
- Content packs: import `.md` or `.zip` files, update a pack in place, weapons and magic items from packs.
- Sheet: D&D Beyond-style layout, Wild Shape, companions and summons, rituals, active effects and triggers, mobile view.
- Many rules fixes from comparing built characters with D&D Beyond.
- Items from the reference keep their reference name and can't be given notes; custom items can still be renamed and noted. A Spell Scroll has a **Spell** field instead of being renamed.
- MIT license for the code and documentation.

## 0.2.0 (2026-11-19)

- **Database:** `supabase/migrations/0001_fivepointfive_instance.sql` (new instances), then `0002_hidden_characters.sql`.
- Shared instances: one admin invites their group; everyone sees the same characters and packs, with an optional live table log.
- Hidden characters: an owner or admin can hide a character from the rest of the instance.
- Password reset and change password.
- Play sheet with clickable rolls, a game log and a dice tray.

## 0.1.0 (2026-11-19)

- Character builder from the SRD 5.2.1, a character sheet, a content library and `.md` imports with a preview that fixes simple formatting problems.
