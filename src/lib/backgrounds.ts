import { createElement, useEffect, useState } from "react";
import { supabase } from "./backend.ts";

/** Backdrops a player can pick for their character sheet (files in public/backgrounds). */
export interface SheetBackground { id: string; name: string; image: string; thumb: string }

export const SHEET_BACKGROUNDS: SheetBackground[] = [
  { id: "forest", name: "Forest", image: "/backgrounds/forest.webp", thumb: "/backgrounds/forest-thumb.webp" },
  { id: "sea", name: "Sea", image: "/backgrounds/sea.webp?v=2", thumb: "/backgrounds/sea-thumb.webp?v=2" },
];

/** The id a character uses for its own uploaded image. */
export const CUSTOM_BACKGROUND = "custom";

/** The built-in backdrop a character picked, if it still exists and an admin hasn't hidden it. */
export function sheetBackground(id?: string, hidden: string[] = []): SheetBackground | undefined {
  return id && !hidden.includes(id) ? SHEET_BACKGROUNDS.find((b) => b.id === id) : undefined;
}

/** Library images are picked as "lib:<id>". */
export const LIBRARY_PREFIX = "lib:";
/** The Storage folder that holds the library (migration 0010). */
export const LIBRARY_FOLDER = "library";

/** An image an admin added to the instance's shared library. */
export interface LibraryBackground {
  id: string;
  name: string;
  /** Storage path of the image, "library/<file>". */
  path: string;
  /** Storage path of a small preview, if one was made. */
  thumb: string | null;
  created_by: string | null;
  created_at: string;
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

/** The size of a token picture, in pixels each way. */
export const TOKEN_PX = 256;

/**
 * Store a character's token picture (already framed and drawn at TOKEN_PX) and return what goes in `tokenImage`, as
 * for backgrounds: "storage:<character id>/token-<file>" on a shared instance, a data URL in local-only mode. The
 * previous picture, if any, is removed. (It sits in the backgrounds bucket, under the same rules: whoever can see the
 * character sees it, and whoever can edit the character changes it.)
 */
export async function uploadToken(characterId: string, img: Blob, previous?: string): Promise<string> {
  if (!supabase) return blobToDataUrl(img);
  const ext = img.type === "image/webp" ? "webp" : img.type === "image/png" ? "png" : "jpg";
  const path = `${characterId}/token-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.${ext}`;
  const { error } = await supabase.storage.from(BACKGROUND_BUCKET).upload(path, img, { contentType: img.type, upsert: false });
  if (error) throw new Error(`Couldn’t upload the picture: ${error.message}`);
  if (previous) await removeBackground(previous);
  return `storage:${path}`;
}

/** URLs to show for several stored images at once (a map's token pictures), by key; missing while loading. */
export function useStoredImages(stored: Record<string, string | undefined>): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const sig = JSON.stringify(stored);
  useEffect(() => {
    let live = true;
    const entries = Object.entries(stored).filter(([, v]) => !!v) as [string, string][];
    Promise.all(entries.map(async ([k, v]) => [k, await storedUrl(v)] as const)).then((got) => {
      if (!live) return;
      const out: Record<string, string> = {};
      for (const [k, u] of got) if (u) out[k] = u;
      setUrls(out);
    });
    return () => { live = false; };
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  return urls;
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

/** A small preview of a stored image, as a span with the image as its background. */
export function StoredThumb({ stored, className }: { stored?: string; className?: string }) {
  const url = useStoredImage(stored);
  return createElement("span", { className, style: url ? { backgroundImage: `url("${url}")` } : undefined }, url ? null : "…");
}

// ---- the shared library (shared instances only) ----

let library: LibraryBackground[] = [];
let libraryLoaded: Promise<void> | null = null;
const libraryListeners = new Set<(l: LibraryBackground[]) => void>();

/** Fetch the library again and tell every page showing it. */
export async function refreshLibrary(): Promise<LibraryBackground[]> {
  if (!supabase) return [];
  const { data } = await supabase.from("backgrounds").select("*").order("created_at");
  library = (data || []) as LibraryBackground[];
  libraryListeners.forEach((f) => f(library));
  return library;
}

/** The instance's library images (empty in local-only mode). */
export function useLibraryBackgrounds(): LibraryBackground[] {
  const [list, setList] = useState(library);
  useEffect(() => {
    libraryListeners.add(setList);
    if (!libraryLoaded) libraryLoaded = refreshLibrary().then(() => undefined);
    else setList(library);
    return () => { libraryListeners.delete(setList); };
  }, []);
  return list;
}

/** The library image a character picked ("lib:<id>"), if it still exists. */
export function libraryBackground(id: string | undefined, list: LibraryBackground[]): LibraryBackground | undefined {
  return id?.startsWith(LIBRARY_PREFIX) ? list.find((b) => LIBRARY_PREFIX + b.id === id) : undefined;
}

/** Admins: add an image to the library, shrunk to WebP with a small preview. */
export async function addLibraryBackground(file: File, name: string): Promise<LibraryBackground> {
  if (!supabase) throw new Error("The library needs a shared instance.");
  if (!file.type.startsWith("image/")) throw new Error("That file isn’t an image.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("That image is over 20 MB. Pick a smaller one.");
  const [img, small] = await Promise.all([shrinkImage(file), shrinkImage(file, 320, 0.75)]);
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const ext = (b: Blob) => (b.type === "image/webp" ? "webp" : "jpg");
  const path = `${LIBRARY_FOLDER}/${id}.${ext(img)}`;
  const thumb = `${LIBRARY_FOLDER}/${id}-thumb.${ext(small)}`;
  const bucket = supabase.storage.from(BACKGROUND_BUCKET);
  const up = await bucket.upload(path, img, { contentType: img.type, upsert: false });
  if (up.error) throw new Error(`Couldn’t upload the image: ${up.error.message}`);
  const upThumb = await bucket.upload(thumb, small, { contentType: small.type, upsert: false });
  const row = { id, name: name.trim() || file.name.replace(/\.[^.]+$/, "") || "Image", path, thumb: upThumb.error ? null : thumb };
  const { data, error } = await supabase.from("backgrounds").insert(row).select().single();
  if (error) {
    await bucket.remove([path, thumb]);
    throw new Error(`Couldn’t save the image: ${error.message}`);
  }
  await refreshLibrary();
  return data as LibraryBackground;
}

/** Admins: rename a library image. */
export async function renameLibraryBackground(id: string, name: string): Promise<void> {
  if (!supabase || !name.trim()) return;
  const { error } = await supabase.from("backgrounds").update({ name: name.trim() }).eq("id", id);
  if (error) throw new Error(error.message);
  await refreshLibrary();
}

/** Admins: delete a library image and its files. */
export async function deleteLibraryBackground(b: LibraryBackground): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("backgrounds").delete().eq("id", b.id);
  if (error) throw new Error(error.message);
  await supabase.storage.from(BACKGROUND_BUCKET).remove([b.path, ...(b.thumb ? [b.thumb] : [])]);
  await refreshLibrary();
}

/** An uploaded file in the bucket, as an admin sees it. */
export interface StoredFile { path: string; size?: number; created_at?: string }

/** Admins: every character upload in the bucket (the library folder is left out), including leftovers. */
export async function listUploadedFiles(): Promise<StoredFile[]> {
  if (!supabase) return [];
  const bucket = supabase.storage.from(BACKGROUND_BUCKET);
  const { data: top, error } = await bucket.list("", { limit: 1000 });
  if (error) throw new Error(error.message);
  const folders = (top || []).filter((f) => !f.id && f.name !== LIBRARY_FOLDER).map((f) => f.name);
  const lists = await Promise.all(folders.map(async (folder) => {
    const { data } = await bucket.list(folder, { limit: 100 });
    return (data || []).filter((f) => f.id).map((f) => ({
      path: `${folder}/${f.name}`,
      size: (f.metadata as { size?: number } | null)?.size,
      created_at: f.created_at || undefined,
    }));
  }));
  return lists.flat();
}

/**
 * The image behind a character's sheet, for showing it elsewhere too (the campaign page's character boxes): its own
 * upload, an image from the instance's library, or a built-in one (undefined if none, or while it loads).
 */
export function useCharacterBackdrop(c: { sheetBackground?: string; customBackground?: string } | undefined, hidden: string[] = []): string | undefined {
  const list = useLibraryBackgrounds();
  const custom = useStoredImage(c?.sheetBackground === CUSTOM_BACKGROUND ? c?.customBackground : undefined);
  const lib = libraryBackground(c?.sheetBackground, list);
  const libUrl = useStoredImage(lib ? `storage:${lib.path}` : undefined);
  if (c?.sheetBackground === CUSTOM_BACKGROUND) return custom;
  if (lib) return libUrl;
  return sheetBackground(c?.sheetBackground, hidden)?.image;
}

