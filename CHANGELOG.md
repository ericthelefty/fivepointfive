# Changelog

What changed in each version of fivepointfive. The newest version is first, and its number matches `version` in `package.json` and the status line in the README.

If you run your own instance, check the **Database** line of each version: when it lists a migration, run that file in your Supabase SQL Editor after you update (see [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md#updating-your-instance)).

## Unreleased

- **Database:** `supabase/migrations/0003_encounters.sql`.
- Encounters, for the DM (the admin on an instance): build a fight from the Library's monsters and your characters, with its difficulty under the 2024 XP budget, then run it. The tracker keeps initiative order, the round and whose turn it is, HP and conditions for everyone in one place, and clickable stat blocks with a roll log. Characters' HP and conditions stay linked to their sheets.

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
