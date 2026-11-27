# Changelog

What changed in each version of fivepointfive. The newest version is first, and its number matches `version` in `package.json` and the status line in the README.

If you run your own instance, check the **Database** line of each version: when it lists a migration, run that file in your Supabase SQL Editor after you update (see [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md#updating-your-instance)).

## Unreleased

- Campaigns, a new Campaigns page. A campaign divides the players of the instance: members see only the players, characters, shared rolls, encounters and loot of their own campaigns, and a player can be in several. The admin creates, renames and deletes campaigns, adds members to them and can make a member a campaign's GM. That GM runs the campaign's encounters and loot (Encounters shows up for them), can edit its characters, add other members of the instance to it as players, take players out, and take a character out of the campaign (it stays with its player). Admins still see everything and can move any character between campaigns.
- Characters and Encounters have a campaign picker at the top when you're in more than one campaign (admins can also pick every campaign). New characters and encounters go into the chosen campaign. Each character card shows its campaign, and its player can move it into another of their campaigns or out of every campaign (then only they and admins see it). Hidden characters are seen by their player, the campaign's GM and admins.
- Invite links can be for a campaign: the new member joins it, and a character given with the invite moves into it. Settings → Members lists each member's campaigns.
- Shared rolls stay within the rolling character's campaign.
- Everything that was there before goes into a first campaign named after the instance, with every member in it, so nothing changes until you add another.
- **Database:** `supabase/migrations/0012_campaigns.sql`.
- A Versatile weapon's Two hands button rolls its two-handed damage (like Damage, with its bigger die), since the attack roll is the same however it's held. After a Critical Hit it rolls the two-handed damage dice twice. An attack's card offers both Roll damage and Two hands, and the attack itself is just the weapon's attack.
- A damage roll that lets you choose its type, like a Pact of the Blade weapon's "Bludgeoning or Necrotic or Psychic or Radiant", opens a small menu of those types by the button you pressed, each with its colour. Picking one rolls the damage as that type: the Game Log shows it and the damage dial plays its animation. Extra damage with its own type, like Hex's Necrotic, keeps it. The type you picked last for that weapon or spell is highlighted next time. It works for the attack table's damage buttons, an attack's Roll damage and Roll crit damage, and spells.
- d6 dice are a little smaller with bigger numbers, so they match the other dice instead of looking larger with small numbers.
- Damage rolls light up a damage dial around the dice. Each of the 13 damage types has its own place on a ring, its own icon (drawn three times larger than at first) and its own animation: the fire rises from its base and waves with embers drifting off, lightning strikes with a flash, thunder booms, force's spikes grow up, the radiant star dawns, the psychic eye opens and looks about, a blade slices twice, an arrow thuds in and quivers, a hammer smashes down, the necrotic skull drains wisps into its eyes and scowls, a poison drop splats, acid splashes, and snow falls round the snowflake. Once the dice land, each type in the roll plays its animation in its colour, one after another, then shows that type's share of the total in the middle of its icon, in the same gold as the dice's modifier with a heavy outline (the icon fades back behind the number once it's up), and the other types aren't shown. A weapon with extra damage, like a Flame Tongue's Fire on top of its Slashing, or a spell that deals two types, shows each type's total. Healing rolls don't show the dial. The dial centres on the dice (the modifier sits outside it) and sits behind them. The dice stay a moment longer when the dial shows, and it works on desktop and phone, in both themes. With 3D dice off it doesn't show, and reduced motion turns its animations off.
- Dice rolls, Critical Hits included, land in the middle of the screen instead of low on the page.
- A Critical Hit gets the stage. Once the dice land, every box on the sheet fades away so only the dice remain over the background (its fade stays), the natural 20 grows a little with a gold glow and "Critical Hit" above it, then after a moment the dice fade and the sheet fades back in. It works for any Critical Hit, so a Champion's 19 counts too. Another roll brings the sheet straight back. With 3D dice off or reduced motion on, a Critical Hit keeps the quick gold flash instead.
- Explainer Mode explains every button that does something. Use, Cast, Cast free, Use a slot, Attack ×2 and the Cast menu say what the feature or spell is, then what pressing it does: what it takes (Action, Bonus Action, Reaction), what it spends and how many you have left, what it rolls, what it starts and how long it lasts, and for spells which slot or free use it takes and whether it needs Concentration. Slot and use pips, Prepare, the spellbook buttons, conditions, Exhaustion, filters, tabs, item and feature rows, and the phone's Heal, Damage and section buttons are explained too. A greyed-out button's explanation adds why it can't be used right now (one bubble instead of two), and anything without its own explanation still says what pressing it does. On a phone, tabs, filters, the section menu, feature and item rows, and the Explainer Mode switch still work while it's on.
- The dice animation shows each die's number only on its last spin, so a tumbling die no longer looks like a spinning coin. On a phone the dice spin and bounce without squashing. While a die moves fast it's blurred, with a faint trail behind it, clearing as it slows (off with reduced motion).
- Flurry of Blows rolls its Unarmed Strikes one after another, so each gets its own dice animation, sound and Game Log entry instead of the animation playing once.
- Arrows, Bolts, Firearm Bullets, Sling Bullets and Needles are items. The SRD lists them as rows of one Ammunition table; each row is now its own item, counted one by one with the weight and price of a single piece (20 Arrows weigh 1 lb.), and its details open the SRD's Ammunition rules. Starting equipment with "20 Arrows" brings real Arrows instead of a custom item.
- Starting equipment matches "Traveler’s Clothes" to the SRD's "Clothes, Traveler’s" (and other names the SRD writes back to front), and a Wizard's Spellbook is an item instead of a custom one. The SRD gives the Spellbook no price or weight.
- Custom items in a saved inventory that are named like an item in the list (Arrows, Bolts, Spellbook…) become that item, keeping their quantity and note.
- Weights with fractions ("1½ lb.") read correctly.
- On a wide screen, the Short rest and Long rest buttons are replaced by the campfire button phones use: it opens a small menu with Short Rest and Long Rest. In Explainer Mode the campfire button, Short Rest and Long Rest each explain themselves, on a phone too: the SRD rule, and what each rest does on this sheet (what comes back, what ends, Hit Point Dice left).
- Admins can name the instance under Settings → Instance name. The name shows next to fivepointfive at the top of every page (in place of the "5.5E compatible" badge on a phone) and in the browser tab.
- Invite links can come with a character. When creating an invite in Settings, pick "Give them…" a character: when the person joins with that link, the character becomes theirs and its sheet opens as soon as their account is set up. The Invites list shows which character each link gives. Only characters an admin still owns can be given, so a link never takes a character away from a player who already has it.
- **Database:** `supabase/migrations/0011_invite_characters.sql`.
- The Notes box on the sheet opens tall enough to show everything in it, and grows as you type, so it never needs its own scrollbar.
- The line describing the character (level, species, class, subclass, background) sits in small type just below the name on the sheet, instead of beside it.
- The sheet background picker is now the Background Image button at the bottom of the sheet, under Explainer Mode (on a phone too, instead of in the Sections menu). Its menu opens upward.
- Print moved from the sheet to the Characters tab: each character has a Print button that opens its sheet, brings up the print window, and goes back when you're done.
- Hide from group is only on the Characters tab now, not on the sheet. A hidden character's sheet still says it's hidden.
- Explainer Mode is written with a capital M everywhere on the sheet.
- Admins have a Sheet backgrounds section in Settings. It lists every image on the instance (built in, the shared library, and each character's upload) with the characters using each one. Admins can add images to the library (shrunk to WebP like other uploads), which then show in every member's Sheet background picker; rename or delete library images; delete any character's upload, including ones left over after a character replaced its image or was deleted; and hide the built-in images from the picker. A sheet whose image is deleted or hidden goes back to no background.
- **Database:** `supabase/migrations/0010_background_library.sql`.
- Each character can have one sheet background of its own: Upload in the Sheet background menu (Replace your image and Remove it once there is one). The browser shrinks the image and saves it as a small WebP file before it's uploaded; on a shared instance it's kept in private storage that only your group can see, and deleting the character deletes it.
- The Sea sheet background is a new photo.
- Character sheets can have a background image: the new Sheet background button next to Print (or the bottom of the Sections menu on a phone) offers None, Forest and Sea. The choice is saved with the character, shows around the edges of the screen and fades to the page colour (dark or parchment, matching the theme) behind the sheet’s text and boxes, so they stay easy to read. It’s left out when you print.
- After a Critical Hit, smites (Divine Smite, Searing Smite, Shining Smite) and "On a hit" extras like Sneak Attack roll their dice twice on their first damage roll for that hit, as the rules say for extra damage dice from the attack; the game log says "Critical hit: dice doubled". Your next attack or d20 roll ends it.
- Right after an attack roll that's a Critical Hit, that attack's Damage button in the Attacks table turns gold and reads "Crit damage": it rolls the damage dice twice (two-handed if that's how you swung), then goes back to normal damage. Any other roll in between ends it. Spell attacks like Eldritch Blast work the same way.
- Curses on an enemy (Hex, Bane, Faerie Fire, Enthrall, Shining Smite) no longer show "I'm a target" under Active now: they only ever hurt their target, so there's nothing to apply to your own sheet. Helpful spells like Bless and Haste still ask.
- Damage that every hit adds by itself is part of the attack: Radiant Strikes shows and rolls "+ 1d8 radiant" on melee weapons and Unarmed Strikes, a Flame Tongue or Frost Brand adds its dice to its own attacks, and Divine Favor to weapon attacks while it lasts. Bonus damage with a condition (only against some creatures, once per turn, a choice) stays a separate "On a hit" row.
- "+1, +2, or +3" magic items (Weapon, Armor, Shield, Ammunition) have a Bonus picker in the Inventory, and go by what they're made of: "Longsword, +2" in the Inventory and on the attack, with the bonus applied.
- Explainer Mode explains Heroic Inspiration (the ★ buttons and the label under your name: what it does, whether you have it, how you get it back), and every line under Defenses, Senses, Languages and Tools: where it comes from and what it means, in the SRD's words (Darkvision, Resistance, Immunity…), how a passive score adds up, and for a tool its ability, check bonus, what you use it for and what you can craft with it.
- Special attacks from your species, class, subclass or feats (Breath Weapon, End Vibrations) are in the Attacks table: save and DC in the new Hit / DC column, the damage, its area (with a picker when you choose the shape, like Breath Weapon's 15-ft. Cone or 30 × 5 ft. Line), uses left, and one Use button that spends a use and rolls the damage.
- The sheet's ability boxes use the short names (STR, DEX, CON, INT, WIS, CHA), so they fit their borders.
- Names built from an effect's id keep small words lower case ("Pact of the Chain", not "Pact Of The Chain").
- Encounters: the Build tab has Save and Discard changes. Edits on the Build tab are held until you save; Discard changes (or reloading the page) goes back to the last saved version. Leaving the Build tab with unsaved changes asks to save them first. Changes on the Run and Loot tabs still save straight away.
- Custom items (names that aren't in the SRD, like an Ankheg Claw) are marked with an asterisk on the sheet's Inventory, in the encounter builder and on the loot page, with a footnote explaining it. The GM can give a custom item a value and weight, in a monster's inventory or on the Loot review, so it sorts by value and weighs what it should.
- **Database:** `supabase/migrations/0008_loot_coins_and_searches.sql`, `supabase/migrations/0009_sheet_backgrounds.sql`.
- Coins and hidden finds. On the Build tab each kind of monster has an Inventory: its gear (starting from the stat block's Gear), the coins it carries, and hidden tiers that a search can turn up ("DC 15: 10 GP; DC 20: also a Ring of Protection"), with the check a search uses (Intelligence (Investigation) or Wisdom (Perception)). Coins the fallen carried go into a shared pot, split evenly between the characters in the fight when the loot closes (a copper that won't split goes to a random player). The loot page has a Defeated tab: each character can search each body once with Investigate, which rolls the check from their sheet; the database hands over what the roll uncovers, and nothing is found twice. The finder keeps each find (straight into their Inventory or coin purse) or shares it (an item joins the loot list, coins join the pot). The loot closes by itself once every item is settled and every find decided, or when the GM closes it. Hidden tiers are readable only by the GM.
- The encounter and loot pages load the SRD's magic items, so magic items on a stat block or added by the GM are priced and found by name.
- **Database:** `supabase/migrations/0007_loot.sql`.
- Loot after an encounter. Monsters at 0 HP, and any marked Surrendered, give up the gear on their stat block (the SRD's Gear entry). On the encounter's new Loot tab the GM reviews it, most valuable first with SRD prices and weights: remove items, lower quantities, add items that aren't on a stat block, then Send to players. Every player with a character in the fight gets a "The battle is over" pop-up: Claim your loot, or Ignore to leave it to the rest of the party. The loot page lists every copy on its own line with I want it and Leave; an item someone else wants shows Roll for it. When everyone has answered an item (or the GM closes the loot), it goes to its only taker, or the takers roll a d20, rolled by the database so every screen sees the same result. Won items land in the winner's Inventory, unequipped, with a line in their game log. Players choose only for the characters they control; the GM can choose for any player in the loot (a picker on the loot page), for someone who isn't at the table. The pop-up doesn't show over the loot page it's for.
- Encounters: a Surrendered checkbox next to Out. A surrendered monster is skipped when the turn moves on, and its gear can be looted.
- Encounters: Restart (with a confirmation) clears the round, turn and initiative and puts monsters back to full HP with no conditions. Roll initiative is there before and during the fight, and asks before replacing initiative already rolled.
- The app says GM (Game Master), the SRD's term, everywhere it used to say DM.
- **Database:** `supabase/migrations/0006_small_live_updates.sql`.
- Live updates are far smaller. A character's game log has its own table, so a roll saves one small line instead of the whole character and its log, and other open screens receive only what changed ("HP 37 → 31"), tagged with a version number. A screen that misses an update notices the gap and fetches a fresh copy, and every screen checks its version numbers once a minute and whenever it comes back to the foreground or reconnects. The game log looks and works the same; existing logs were moved over.
- Encounters: every combatant has a d20 button under their initiative box to roll just theirs, and "Roll initiative for everyone" and "for monsters" are clearer before the fight. During a fight, Re-roll initiative rolls again for everyone, monsters and characters; the round number stays and the turn goes to whoever is first in the new order.
- Encounters: every line in the encounter's log (rolls, attacks, damage, initiative, new rounds) also appears in the game log of each character in the fight, tagged with the encounter's name, so players can follow what's happening around them.
- The badge, page title, README and GitHub description say "5.5E compatible".
## 0.4.0 (2026-11-23)

- **Database:** `supabase/migrations/0003_encounters.sql`, then `0004_live_characters.sql`, then `0005_assign_characters.sql`.

### For groups and DMs

- Encounters, for the DM (the admin on an instance): build a fight from the Library's monsters and your characters, with its difficulty under the 2024 XP budget, then run it. The tracker keeps initiative order, the round and whose turn it is, HP and conditions for everyone in one place, and clickable stat blocks with a roll log. Characters' HP and conditions stay linked to their sheets.
- Live characters: a change made anywhere (the DM's tracker, the same character open on another device or tab) shows up on every open sheet within a second or two. When two people change a character at once, both changes are kept: HP changes add up, conditions and game log entries combine. Before, an open sheet only picked up changes after a reload, and saving from it could undo them.
- Adding or removing a condition from the encounter tracker puts a line in the character's game log.
- Admins can give a character to another player from its card on the Characters page (the Player menu). The player then owns it as if they had made it, for example a sheet you imported for them.
- Demo link: open `/demo` on any instance to try the builder and sheet without signing in. It opens a ready-made sample character (Vessa Quill, Elf Wizard 3), and visitors can build their own too. Everything they make stays in their own browser and never reaches the instance; Exit demo goes back to normal.

### Phones

- New phone layout for the play sheet: a compact header stays at the top (name, rests, Heroic Inspiration, AC, Initiative, Speed, Hit Points with Heal and Damage, conditions, spell DC), and one section fills the screen at a time. Tap the grid button to switch between Abilities & Saves, Skills, Actions, Spells, Inventory, Features & Feats, Effects, Conditions, Defenses, Senses, Languages & Tools, Background, Notes and the Game Log. The round d20 button in the bottom left opens roll mode, the next-roll bonus and the free dice; the scroll button in the bottom right opens the Game Log over the whole screen and counts rolls you haven't seen. Tapping Hit Points opens Heal, Damage, Temp HP and Hit Dice. Print only shows on desktop.
- Phones: attacks, bonus actions and other action lists are cards instead of squeezed tables: the name on the left, to-hit and damage on the right, and big Attack, Damage and Cast buttons underneath.
- Phones: the dice tumble flat and land properly (the 3D flip drew them skewed), and the modifier has a dark outline so it's easy to read.
- On phones, the Game Log closes back to its button when the window narrows into the phone layout.

### The play sheet

- New look for the play sheet ("Forged"): each kind of number has its own frame. Armor Class sits in a shield, initiative, speed, proficiency and passive Perception in notched plates, the spell save DC in a gem, and each ability's modifier in a cut-corner tile with the score in a round rivet below it. Hit points get a gold frame with Heal, the amount and Damage stacked on the left. Skill and save proficiency marks are diamonds: filled for proficient, ringed for expertise, half-filled for half proficiency.
- On laptops and desktops the six ability scores sit in one row under AC and the other stats, and the tiles are shorter, so the stats, abilities and hit points fit on one screen.
- Denser sheet on laptops and desktops: the name, Edit and class line share one line with the rest buttons; the six abilities and the AC / initiative / speed / proficiency / passive Perception / spell DC boxes share one band; below it, skills with defenses, senses and languages under them in one left column, and the tabs beside them, with tighter rows and tabs on one line, so attacks show without scrolling. The side column is narrower.
- The AC / initiative / speed / proficiency / passive Perception / spell DC row is shorter: less empty space above and below each number (the "click to roll" hint under Initiative is gone; Explainer Mode covers it).
- Hit points moved to the top of the right-hand column, above the roll bar, in a smaller box. On phones and tablets they still follow the stats.
- Edit in builder (and the "choices left" tag) sits right next to the character's name.
- Short rest and Long rest moved to the top of the sheet, on the line with the character's name.
- Tidier roll bar: advantage, normal and disadvantage across the top; the next-roll bonus with Heroic Inspiration, 3D dice and dice sound as small icon toggles beside it. It takes about half the height.
- Every time a sheet opens or reloads, a band of light sweeps across everything you can click to roll (abilities, saves, skills, initiative, attacks, the dice), one after another, so new players can see what's clickable. Skipped with reduced motion.
- The roll-button shimmer is easier to see in the light theme, and a thinner band of light.

### Dice and the Game Log

- Game log: attack and damage rolls show the dice and the modifier beside the total (for example 13 + 6), and the newest total pops to twice its size for a moment.
- 3D dice: the roll's modifier lands beside the dice, slanted at a different random angle every roll, in a gold that suits the light or dark theme.
- With 3D dice on, a roll's game log card shows three dots appearing one at a time until the modifier appears beside the dice, then shows the total at the same moment (a critical hit's flash waits too), so the log doesn't give the result away first.
- The game log's dice buttons (d4 to d100) and typed rolls like 2d6+3 roll the 3D dice too, with the modifier beside them.
- 3D dice and the modifier beside them are twice the size on laptops and desktops.

### Explainer Mode

- Explainer Mode: a switch centred at the bottom of the sheet. With it on, hovering over a number shows how it's worked out, part by part with a total: abilities, saves, skills (proficiency and where it came from, expertise, Jack of All Trades), passive Perception, AC, initiative, speed, Proficiency Bonus, spell save DC and spell attack, Hit Point maximum and attack bonuses, plus any advantage or disadvantage that applies. The breakdown appears in the same light bubble as the sheet's other tips. Clicking still rolls. The old hover tips on AC, speed, Proficiency, passive Perception and attack bonuses are replaced by it.
- Explainer Mode says where each limited use and spell slot comes from ("From your Paladin class: the Paladin's Smite feature", "From being a Dragonborn").
- Explainer Mode explains rules and controls too: advantage and disadvantage, Short and Long Rests, Heal, Damage and Temporary Hit Points, attack and damage rolls, the dice roller and the header buttons. Every number's breakdown ends with how you can change it, and AC now shows its parts (armor, Dexterity, shield, features).
- With Explainer Mode off, nothing on the sheet pops up on hover: no tips, no browser tooltips, and no dotted underlines. Turn it on and every tip, every button's explanation (including why a greyed-out button can't be used) and every number's breakdown appears on hover in the same bubble.
- Explainer Mode on phones and tablets: tapping a number explains it and dice don't roll while it's on; the description says so.
- Explainer Mode on phones: every dice roll is off, including buttons that have no explanation of their own. Tapping one says that rolling is off until you turn Explainer Mode off.
- Explainer Mode: explanation bubbles always fit inside the window; one that would run off an edge moves back in.

### Spells

- Manage Spells (Spells tab) opens a side panel instead of the builder: search your class's spell list by name, school or casting time, filter by level or show only yours, learn cantrips and prepare spells within your limits, with always-prepared spells marked. Wizards add spells to their spellbook with their free level-up picks or by copying them in (50 GP and 2 hours a level), and prepare from the book. Multiclass casters switch between classes at the top. A spell's name opens its full description, with a link back.
- Manage Spells explains known versus prepared spells and which ones you can cast in play; for Wizards, how the spellbook works. "Add to spellbook" uses one of the two spells you add each Wizard level (no cost); copying a found spell asks first and gives the SRD cost (2 hours and 50 GP per spell level).
- Rules wording follows the SRD: each class's own "Changing Your Prepared Spells" rule is quoted in Manage Spells (Paladins and Rangers replace one spell after a Long Rest; Bards, Sorcerers and Warlocks when they gain a level), and the Short Rest, Long Rest and Temporary Hit Points explanations use the SRD's terms.
- Wizards in Manage Spells: a Spellbook filter and an "In your book" label on each spell already in the book; a three-step checklist (choose cantrips, add spells from your Wizard levels, prepare from the spellbook) while any step is unfinished; and an explanation of how many spells you can add. The builder's spell step tells Wizards that their picks go into the spellbook and start out prepared.
- Spells that make attack rolls (Eldritch Blast, Scorching Ray…) have Attack and Damage buttons in the Actions tab, like weapons. Cantrips just roll; a levelled spell keeps a Cast button that spends the slot first. For several beams or rays, roll once per beam.

### Items and features

- Magic staffs and rods that can be wielded as a weapon (Staff of Striking, Staff of Power, Rod of Lordly Might and others) now attack as that weapon once equipped: their attack and damage bonuses are added to the attack row (Staff of Striking: +3 to hit and damage), and you're no longer asked to choose a base weapon when there's only one.
- An item's charges show on its attack row with buttons to spend or restore one. Under "On a hit", the Staff of Striking lets you pick 1 to 3 charges, rolls that many d6 of Force damage and spends the charges.
- Items you add to your Inventory start closed, with a ▾ beside the name to open the full description.
- Inventory: armor, shields and weapons stay near the top after you unequip them, under what you have equipped, instead of dropping into the rest of your gear.
- Weapon Mastery: after a Long Rest the game log card offers "Change Weapon Mastery", and the Actions tab links to the picker (Features & Feats › Change after a rest). The builder still lets you change it anytime.
- "Change after a rest" choices with many options (Weapon Mastery) put the options under the feature's name instead of squeezing it.
- Features like Pact Magic, Lay On Hands and Bardic Inspiration no longer show the class's whole 20-level table (the SRD prints it inside them). The sheet and builder show one line with your row instead, e.g. "At Bard level 6: Bardic Die D8 · Cantrips 3 · Prepared Spells 10 · Spell Slots L1 ×4, L2 ×3, L3 ×3".
- The Spend Hit Die button only shows when you can use it (you've taken damage and have Hit Dice left); Explainer Mode says what Hit Dice do.
- Removed the "Reset to starting equipment" link from the Inventory tab.

### Modif and the docs

- Modif 0.7 adds one block, `wield-as`, for items that fight as a weapon their tagline doesn't name ("can be wielded as a magic Quarterstaff"). Seven SRD staffs and rods use it, and the app reads it instead of the description. The validator and `modif.schema.json` know it.
- The Modif spec now opens with what Modif is, a worked example, where to start for content authors and for app developers, and how `custom` hand-coded rules fit in. Its version history moved to `docs/MODIF_CHANGES.md`.
- The README describes the current app and explains Modif.

### Fixes

- Fixed: a High Elf now starts out knowing Prestidigitation (the lineage's default cantrip) instead of showing "1 choice left" with no cantrip.
- Fixed: preparing a spell a feature added to the spellbook (Evocation Savant) no longer uses up one of the spells you add from Wizard levels.
- A tooltip on a framed box (Speed, Proficiency…) no longer slips behind the boxes below it.
- Hovering an ability score no longer cuts off the round score badge under it.

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
