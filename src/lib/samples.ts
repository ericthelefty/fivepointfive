import { newCharacter, type Character } from "./rules.ts";
import { newId } from "./characters.tsx";

/** Ready-made SRD characters to try the sheet with, then keep or delete. */
export const SAMPLES: { label: string; c: Partial<Character> }[] = [
  { label: "Bram Ironside, Dwarf Fighter 5", c: { name: "Bram Ironside", level: 5, classId: "srd:class/fighter", subclassId: "srd:subclass/champion", speciesId: "srd:species/dwarf", backgroundId: "srd:background/soldier",
    method: "standard", base: { Strength: 15, Dexterity: 14, Constitution: 13, Intelligence: 8, Wisdom: 10, Charisma: 12 }, bonusMode: "2-1", bonus: { Strength: 2, Constitution: 1 },
    classSkills: ["Perception", "Survival"], extraSkills: [], equipClass: "A", equipBackground: "A", cantrips: [], spells: [], languages: ["Dwarvish", "Giant"] } as Partial<Character> },
  { label: "Vessa Quill, Elf Wizard 3", c: { name: "Vessa Quill", level: 3, classId: "srd:class/wizard", subclassId: "srd:subclass/evoker", speciesId: "srd:species/elf", speciesChoice: "High Elf", backgroundId: "srd:background/sage",
    method: "standard", base: { Strength: 8, Dexterity: 12, Constitution: 13, Intelligence: 15, Wisdom: 14, Charisma: 10 }, bonusMode: "2-1", bonus: { Intelligence: 2, Constitution: 1 },
    classSkills: ["Investigation", "Insight"], extraSkills: ["Perception"], equipClass: "A", equipBackground: "A", cantrips: ["Fire Bolt", "Light", "Mage Hand"],
    spells: ["Magic Missile", "Shield", "Burning Hands", "Scorching Ray", "Mage Armor"], languages: ["Draconic", "Elvish"],
    spellbook: [{ name: "Detect Magic", how: "level" }, { name: "Feather Fall", how: "level" }, { name: "Thunderwave", how: "level" }],
    choices: { "srd:class/wizard#scholar": ["Arcana"], "srd:subclass/evoker#savant": ["srd:spell/magic-missile", "srd:spell/burning-hands"], "srd:subclass/evoker#savant-more": ["srd:spell/shatter"],
      "srd:species/elf#lineage-ability": ["Intelligence"], "srd:feat/magic-initiate#mi-ability": ["Intelligence"],
      "srd:feat/magic-initiate#mi-cantrips": ["srd:spell/ray-of-frost", "srd:spell/minor-illusion"], "srd:feat/magic-initiate#mi-spell": ["srd:spell/sleep"] } } as Partial<Character> },
  { label: "Fen, Human Druid 6", c: { name: "Fen", level: 6, classId: "srd:class/druid", subclassId: "srd:subclass/circle-of-the-land", speciesId: "srd:species/human", backgroundId: "srd:background/sage",
    method: "standard", base: { Strength: 8, Dexterity: 14, Constitution: 13, Intelligence: 10, Wisdom: 15, Charisma: 12 }, bonusMode: "2-1", bonus: { Wisdom: 2, Constitution: 1 },
    classSkills: ["Perception", "Nature"], extraSkills: [], equipClass: "A", equipBackground: "A", cantrips: ["Druidcraft", "Produce Flame"], spells: ["Cure Wounds", "Entangle", "Healing Word", "Moonbeam", "Thunderwave"],
    languages: ["Elvish", "Halfling"] } as Partial<Character> },
];

/** A fresh copy of a sample character, ready to save. */
export function makeSample(sm: (typeof SAMPLES)[number]): Character {
  return { ...newCharacter(), ...structuredClone(sm.c), id: newId(), updated: Date.now() } as Character;
}
