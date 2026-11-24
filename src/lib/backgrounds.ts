import { useEffect, useState } from "react";
import { supabase } from "./backend.ts";

/** Backdrops a player can pick for their character sheet (files in public/backgrounds). */
export interface SheetBackground { id: string; name: string; image: string; thumb: string }

export const SHEET_BACKGROUNDS: SheetBackground[] = [
  { id: "forest", name: "Forest", image: "/backgrounds/forest.webp", thumb: "/backgrounds/forest-thumb.webp" },
  { id: "sea", name: "Sea", image: "/backgrounds/sea.webp?v=2", thumb: "/backgrounds/sea-thumb.webp?v=2" },
];

/** The id a character uses for its own uploaded image. */
export const CUSTOM_BACKGROUND = "custom";

/** The built-in backdrop a character picked, if it still exists. */
export function sheetBackground(id?: string): SheetBackground | undefined {
  return id ? SHEET_BACKGROUNDS.find((b) => b.id === id) : undefined;
}

/** The private Storage bucket for uploaded backgrounds (migration 0009): one folder per character. */
export const BACKGROUND_BUCKET = "fivepointfive-backgrounds";
/** Uploads larger than this are refused before any work is done. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/**
 * Shrink an image to at most `maxWidth` pixels wide (and 1.5× that tall) and re-encode it as WebP,
 * falling back to JPEG in browsers that can't write WebP. Returns the new file and its type.
 */
export async function shrinkImage(file: Blob, maxWidth = 1920, quality = 0.8): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bmp.width, (maxWidth * 1.5) / bmp.height);
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("This browser can’t resize images.");
  g.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const encode = (type: string) => new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, quality));
  const webp = await encode("image/webp");
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await encode("image/jpeg");
  if (!jpeg) throw new Error("Couldn’t convert the image.");
  return jpeg;
}

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((ok, bad) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => bad(r.error);
    r.readAsDataURL(b);
  });

/**
 * Store a character's uploaded background and return what goes in `customBackground`:
 * the Storage path ("storage:<character id>/<file>") on a shared instance, or a data URL in local-only mode.
 * The previous upload, if any, is removed, so each character keeps one.
 */
export async function uploadBackground(characterId: string, file: File, previous?: string): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("That file isn’t an image.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("That image is over 20 MB. Pick a smaller one.");
  if (!supabase) {
    // local-only: kept inside the character in this browser, so smaller
    return blobToDataUrl(await shrinkImage(file, 1280, 0.72));
  }
  const img = await shrinkImage(file);
  const ext = img.type === "image/webp" ? "webp" : "jpg";
  const path = `${characterId}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.${ext}`;
  const { error } = await supabase.storage.from(BACKGROUND_BUCKET).upload(path, img, { contentType: img.type, upsert: false });
  if (error) throw new Error(`Couldn’t upload the image: ${error.message}`);
  if (previous) await removeBackground(previous);
  return `storage:${path}`;
}

/** Delete an uploaded background (best effort: a file that's already gone is fine). */
export async function removeBackground(stored?: string): Promise<void> {
  if (!stored?.startsWith("storage:") || !supabase) return;
  await supabase.storage.from(BACKGROUND_BUCKET).remove([stored.slice("storage:".length)]);
}

/** Delete every uploaded background of a character (when the character is deleted). */
export async function removeCharacterBackgrounds(characterId: string): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.storage.from(BACKGROUND_BUCKET).list(characterId);
  if (data?.length) await supabase.storage.from(BACKGROUND_BUCKET).remove(data.map((f) => `${characterId}/${f.name}`));
}

// Private files are downloaded once and shown from a local URL.
const urlCache = new Map<string, Promise<string | undefined>>();
function storedUrl(stored: string): Promise<string | undefined> {
  if (!stored.startsWith("storage:")) return Promise.resolve(stored);
  let p = urlCache.get(stored);
  if (!p) {
    p = (async () => {
      if (!supabase) return undefined;
      const { data } = await supabase.storage.from(BACKGROUND_BUCKET).download(stored.slice("storage:".length));
      return data ? URL.createObjectURL(data) : undefined;
    })();
    urlCache.set(stored, p);
    p.then((u) => { if (!u) urlCache.delete(stored); });
  }
  return p;
}

/** A URL the page can show for a character's uploaded background (undefined while loading or if there's none). */
export function useStoredImage(stored?: string): string | undefined {
  const [url, setUrl] = useState<string | undefined>(() => (stored && !stored.startsWith("storage:") ? stored : undefined));
  useEffect(() => {
    let live = true;
    if (!stored) { setUrl(undefined); return; }
    storedUrl(stored).then((u) => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [stored]);
  return url;
}
