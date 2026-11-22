/**
 * Characters, from browser storage (local mode) or the instance database.
 * Members see every character in the instance except hidden ones (the owner and admins still see those);
 * the owner or an admin can edit, and hide or show it.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cloud, supabase } from "./backend.ts";
import { useSession } from "./session.tsx";
import { deleteCharacter as localDelete, loadCharacters, saveCharacter as localSave } from "./store.tsx";
import type { Character } from "./rules.ts";

export interface CharRow {
  c: Character;
  owner?: string;
  /** Hidden from the rest of the instance (only the owner and admins see it). */
  hidden?: boolean;
}

interface CharState {
  ready: boolean;
  rows: CharRow[];
  get: (id?: string) => CharRow | undefined;
  save: (c: Character) => void;
  create: (c: Character) => Promise<void>;
  remove: (id: string) => Promise<void>;
  canEdit: (id?: string) => boolean;
  /** Hide a character from the rest of the instance, or show it again. */
  setHidden: (id: string, hidden: boolean) => Promise<void>;
  reload: () => Promise<void>;
  saving: boolean;
  error?: string;
}

const Ctx = createContext<CharState | null>(null);

export function CharactersProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const [rows, setRows] = useState<CharRow[]>(() => (cloud ? [] : loadCharacters().map((c) => ({ c }))));
  const [ready, setReady] = useState(!cloud);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pending = useRef<Record<string, Character>>({});

  const reload = useCallback(async () => {
    if (!supabase || session.status !== "ready") return;
    const { data, error: e } = await supabase.from("characters").select("id, owner, hidden, data, updated_at").order("updated_at", { ascending: false });
    if (e) {
      setError(e.message);
      return;
    }
    setRows((data || []).map((r) => ({ c: { ...(r.data as Character), id: r.id }, owner: r.owner, hidden: !!r.hidden })));
    setReady(true);
  }, [session.status]);

  useEffect(() => {
    if (!cloud) return;
    if (session.status === "ready") reload();
    else {
      setRows([]);
      setReady(false);
    }
  }, [session.status, reload]);

  useEffect(() => {
    if (!cloud) return;
    const onFocus = () => {
      if (!Object.keys(pending.current).length) reload();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);

  const flush = useCallback(async (id: string) => {
    const c = pending.current[id];
    if (!c || !supabase) return;
    delete pending.current[id];
    setSaving(true);
    const { error: e } = await supabase.from("characters").update({ data: c, updated_at: new Date().toISOString() }).eq("id", id);
    setSaving(Object.keys(pending.current).length > 0);
    if (e) setError(`Couldn’t save: ${e.message}`);
  }, []);

  // flush unsaved changes before the page goes away
  useEffect(() => {
    const onHide = () => {
      for (const id of Object.keys(pending.current)) {
        clearTimeout(timers.current[id]);
        flush(id);
      }
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [flush]);

  const canEdit = (id?: string) => {
    if (!cloud) return true;
    const r = rows.find((x) => x.c.id === id);
    return !!r && (r.owner === session.user?.id || session.isAdmin);
  };

  const save = (c: Character) => {
    const next = { ...c, updated: Date.now() };
    setRows((prev) => prev.map((r) => (r.c.id === c.id ? { ...r, c: next } : r)));
    if (!cloud) {
      localSave(next);
      return;
    }
    pending.current[c.id] = next;
    clearTimeout(timers.current[c.id]);
    timers.current[c.id] = setTimeout(() => flush(c.id), 600);
  };

  const create = async (c: Character) => {
    if (!cloud) {
      localSave(c);
      setRows((prev) => [{ c }, ...prev]);
      return;
    }
    const { error: e } = await supabase!.from("characters").insert({ id: c.id, data: c });
    if (e) {
      setError(`Couldn’t create character: ${e.message}`);
      throw e;
    }
    setRows((prev) => [{ c, owner: session.user?.id }, ...prev]);
  };

  const remove = async (id: string) => {
    if (!cloud) localDelete(id);
    else {
      const { error: e } = await supabase!.from("characters").delete().eq("id", id);
      if (e) {
        setError(`Couldn’t delete: ${e.message}`);
        return;
      }
    }
    setRows((prev) => prev.filter((r) => r.c.id !== id));
  };

  const setHidden = async (id: string, hidden: boolean) => {
    if (!supabase) return;
    setRows((prev) => prev.map((r) => (r.c.id === id ? { ...r, hidden } : r)));
    const { error: e } = await supabase.from("characters").update({ hidden }).eq("id", id);
    if (e) {
      setError(`Couldn’t ${hidden ? "hide" : "show"} the character: ${e.message}`);
      setRows((prev) => prev.map((r) => (r.c.id === id ? { ...r, hidden: !hidden } : r)));
    }
  };

  return (
    <Ctx.Provider value={{ ready, rows, get: (id) => rows.find((r) => r.c.id === id), save, create, remove, canEdit, setHidden, reload, saving, error }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCharacters(): CharState {
  const c = useContext(Ctx);
  if (!c) throw new Error("CharactersProvider missing");
  return c;
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}
