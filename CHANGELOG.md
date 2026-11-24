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
- Every time a sheet opens or reloads, a band of light sweeps across everything you can click to roll (abilities, saves, skills, initiative, attacks, the dice), one after another, so new players can see what's clickable. Skipped with reduced motion.
- The Spend Hit Die button only shows when you can use it (you've taken damage and have Hit Dice left); Explainer mode says what Hit Dice do.
- Explainer mode: a switch centred at the bottom of the sheet. With it on, hovering over a number shows how it's worked out, part by part with a total: abilities, saves, skills (proficiency and where it came from, expertise, Jack of All Trades), passive Perception, AC, initiative, speed, Proficiency Bonus, spell save DC and spell attack, Hit Point maximum and attack bonuses, plus any advantage or disadvantage that applies. The breakdown appears in the same light bubble as the sheet's other tips. Clicking still rolls. The old hover tips on AC, speed, Proficiency, passive Perception and attack bonuses are replaced by it.
- Explainer mode says where each limited use and spell slot comes from ("From your Paladin class: the Paladin's Smite feature", "From being a Dragonborn").
- Explainer mode explains rules and controls too: advantage and disadvantage, Short and Long Rests, Heal, Damage and Temporary Hit Points, attack and damage rolls, the dice roller and the header buttons. Every number's breakdown ends with how you can change it, and AC now shows its parts (armor, Dexterity, shield, features).
- "Change after a rest" choices with many options (Weapon Mastery) put the options under the feature's name instead of squeezing it.
- The roll-button shimmer is easier to see in the light theme, and a thinner band of light.
- Denser sheet on laptops and desktops: the name, Edit and class line share one line with the rest buttons; the six abilities and the AC / initiative / speed / proficiency / passive Perception / spell DC boxes share one band; below it, skills with defenses, senses and languages under them in one left column, and the tabs beside them, with tighter rows and tabs on one line, so attacks show without scrolling. The side column is narrower.
- Manage Spells (Spells tab) opens a side panel instead of the builder: search your class's spell list by name, school or casting time, filter by level or show only yours, learn cantrips and prepare spells within your limits, with always-prepared spells marked. Wizards add spells to their spellbook with their free level-up picks or by copying them in (50 GP and 2 hours a level), and prepare from the book. Multiclass casters switch between classes at the top. A spell's name opens its full description, with a link back.
- Removed the "Reset to starting equipment" link from the Inventory tab.
- Weapon Mastery: after a Long Rest the game log card offers "Change Weapon Mastery", and the Actions tab links to the picker (Features & Feats › Change after a rest). The builder still lets you change it anytime.
- The AC / initiative / speed / proficiency / passive Perception / spell DC row is shorter: less empty space above and below each number (the "click to roll" hint under Initiative is gone; Explainer mode covers it).
- With Explainer mode off, nothing on the sheet pops up on hover: no tips, no browser tooltips, and no dotted underlines. Turn it on and every tip, every button's explanation (including why a greyed-out button can't be used) and every number's breakdown appears on hover in the same bubble.
- A tooltip on a framed box (Speed, Proficiency…) no longer slips behind the boxes below it.
- Hovering an ability score no longer cuts off the round score badge under it.
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
