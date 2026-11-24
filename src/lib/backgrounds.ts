/** Backdrops a player can pick for their character sheet (files in public/backgrounds). */
export interface SheetBackground { id: string; name: string; image: string; thumb: string }

export const SHEET_BACKGROUNDS: SheetBackground[] = [
  { id: "forest", name: "Forest", image: "/backgrounds/forest.webp", thumb: "/backgrounds/forest-thumb.webp" },
  { id: "sea", name: "Sea", image: "/backgrounds/sea.webp", thumb: "/backgrounds/sea-thumb.webp" },
];

/** The backdrop a character picked, if it still exists. */
export function sheetBackground(id?: string): SheetBackground | undefined {
  return id ? SHEET_BACKGROUNDS.find((b) => b.id === id) : undefined;
}
