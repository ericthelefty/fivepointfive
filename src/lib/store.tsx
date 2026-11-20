import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { get as idbGet, set as idbSet } from "idb-keyval";
import { parseFile, slug, stripMd, type Entry } from "./parse.ts";
import type { Character } from "./rules.ts";
import { cloud, supabase } from "./backend.ts";
import { useSession } from "./session.tsx";

export interface PackInfo {
  id: string;
  name: string;
  builtIn: boolean;
  entries: number;
  license?: string;
  author?: string;
  owner?: string;
}

export interface UserPack {
  id: string;
  name: string;
  files: { file: string; text: string }[];
  created: number;
  owner?: string;
}

type Chunk = "core" | "spells" | "items" | "creatures" | "rules";

interface ContentState {
  ready: boolean;
  error?: string;
  entries: Entry[];
  packs: PackInfo[];
  userPacks: UserPack[];
  loaded: Set<Chunk>;
  ensure: (...chunks: Chunk[]) => Promise<void>;
  saveUserPack: (p: UserPack) => Promise<void>;
  deleteUserPack: (id: string) => Promise<void>;
  byType: (type: string) => Entry[];
  byId: (id?: string) => Entry | undefined;
}

const Ctx = createContext<ContentState | null>(null);
const USER_KEY = "fpf.userPacks";

interface Manifest { id: string; name: string; entries: number; files: Record<string, string> }

export function entriesForUserPack(p: UserPack): Entry[] {
  return p.files.flatMap((f) => parseFile(f.text, p.id, f.file)).filter((e) => e.type !== "Pack");
}

/** The pack.md entry of a user pack, if it has one (author, license, description). */
export function packMeta(p: UserPack): Entry | undefined {
  return p.files.flatMap((f) => parseFile(f.text, p.id, f.file)).find((e) => e.type === "Pack");
}

/**
 * Apply **Replaces:** lines: a user entry that replaces another entry hides it,
 * and lookups of the old ID (for example a character's class) get the new entry.
 */
export function applyReplacements(all: Entry[]): { visible: Entry[]; index: Map<string, Entry> } {
  const replacedBy = new Map<string, Entry>();
  for (const e of all) {
    const r = stripMd(e.fields["replaces"] || "").trim().toLowerCase();
    if (r && r !== e.id) replacedBy.set(r, e);
  }
  const visible = all.filter((e) => !replacedBy.has(e.id));
  const index = new Map(visible.map((e) => [e.id, e]));
  for (const [old, e] of replacedBy) index.set(old, e);
  return { visible, index };
}

export function ContentProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const [manifest, setManifest] = useState<Manifest[]>([]);
  const [chunks, setChunks] = useState<Record<string, Entry[]>>({});
  const [userPacks, setUserPacks] = useState<UserPack[]>([]);
  const [loaded, setLoaded] = useState<Set<Chunk>>(new Set());
  const [error, setError] = useState<string>();

  const load = useCallback(async (m: Manifest[], which: Chunk[]) => {
    const add: Record<string, Entry[]> = {};
    await Promise.all(
      m.flatMap((p) =>
        which.filter((c) => p.files[c]).map(async (c) => {
          const r = await fetch(`/data/${p.files[c]}`);
          add[`${p.id}-${c}`] = await r.json();
        }),
      ),
    );
    setChunks((prev) => ({ ...prev, ...add }));
    setLoaded((prev) => new Set([...prev, ...which]));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const m: Manifest[] = await (await fetch("/data/manifest.json")).json();
        setManifest(m);
        await load(m, ["core"]);
        if (!cloud) setUserPacks((await idbGet<UserPack[]>(USER_KEY)) || []);
      } catch (e) {
        setError(String(e));
      }
    })();
  }, [load]);

  // instance packs: shared with every member
  const loadCloudPacks = useCallback(async () => {
    if (!supabase) return;
    const { data, error: e } = await supabase.from("packs").select("id, owner, name, files, updated_at").order("name");
    if (e) return;
    setUserPacks((data || []).map((r) => ({ id: r.id, name: r.name, files: r.files || [], created: Date.parse(r.updated_at), owner: r.owner })));
  }, []);
  useEffect(() => {
    if (cloud && session.status === "ready") loadCloudPacks();
    if (cloud && session.status !== "ready") setUserPacks([]);
  }, [session.status, loadCloudPacks]);

  const ensure = useCallback(
    async (...want: Chunk[]) => {
      const missing = want.filter((c) => !loaded.has(c));
      if (missing.length && manifest.length) await load(manifest, missing);
    },
    [loaded, manifest, load],
  );

  const userEntries = useMemo(() => userPacks.flatMap(entriesForUserPack), [userPacks]);
  const { visible: entries, index } = useMemo(() => applyReplacements([...Object.values(chunks).flat(), ...userEntries]), [chunks, userEntries]);
  const typeIndex = useMemo(() => {
    const m = new Map<string, Entry[]>();
    for (const e of entries) (m.get(e.type) || m.set(e.type, []).get(e.type)!).push(e);
    return m;
  }, [entries]);

  const packs: PackInfo[] = useMemo(
    () => [
      ...manifest.map((p) => ({ id: p.id, name: p.name, builtIn: true, entries: p.entries, license: "CC-BY-4.0", author: "Wizards of the Coast LLC" })),
      ...userPacks.map((p) => {
        const meta = packMeta(p);
        return { id: p.id, name: p.name, builtIn: false, entries: entriesForUserPack(p).length, owner: p.owner, license: meta?.fields["license"], author: meta?.fields["author"] };
      }),
    ],
    [manifest, userPacks],
  );

  const saveUserPack = useCallback(async (p: UserPack) => {
    if (supabase) {
      const { error: e } = await supabase.from("packs").upsert({ id: p.id, name: p.name, files: p.files, updated_at: new Date().toISOString() });
      if (e) throw new Error(e.message);
      await loadCloudPacks();
      return;
    }
    const all = ((await idbGet<UserPack[]>(USER_KEY)) || []).filter((x) => x.id !== p.id);
    all.push(p);
    await idbSet(USER_KEY, all);
    setUserPacks(all);
  }, [loadCloudPacks]);
  const deleteUserPack = useCallback(async (id: string) => {
    if (supabase) {
      const { error: e } = await supabase.from("packs").delete().eq("id", id);
      if (e) throw new Error(e.message);
      await loadCloudPacks();
      return;
    }
    const all = ((await idbGet<UserPack[]>(USER_KEY)) || []).filter((x) => x.id !== id);
    await idbSet(USER_KEY, all);
    setUserPacks(all);
  }, [loadCloudPacks]);

  const value: ContentState = {
    ready: loaded.has("core"),
    error,
    entries,
    packs,
    userPacks,
    loaded,
    ensure,
    saveUserPack,
    deleteUserPack,
    byType: (t) => typeIndex.get(t) || [],
    byId: (id) => (id ? index.get(id) : undefined),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useContent(): ContentState {
  const c = useContext(Ctx);
  if (!c) throw new Error("ContentProvider missing");
  return c;
}

export function packIdFor(name: string, existing: string[]): string {
  const base = slug(name) || "homebrew";
  let id = base === "srd" ? "srd-user" : base;
  let n = 2;
  while (existing.includes(id)) id = `${base}-${n++}`;
  return id;
}

// ---------------------------------------------------------------- characters
const CHAR_KEY = "fpf.characters";

export function loadCharacters(): Character[] {
  try {
    return JSON.parse(localStorage.getItem(CHAR_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveCharacter(c: Character) {
  const all = loadCharacters().filter((x) => x.id !== c.id);
  all.push({ ...c, updated: Date.now() });
  try {
    localStorage.setItem(CHAR_KEY, JSON.stringify(all));
  } catch {
    /* storage full or unavailable */
  }
}

export function deleteCharacter(id: string) {
  try {
    localStorage.setItem(CHAR_KEY, JSON.stringify(loadCharacters().filter((x) => x.id !== id)));
  } catch {
    /* ignore */
  }
}
