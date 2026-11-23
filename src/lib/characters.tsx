/**
 * Characters, from browser storage (local mode) or the instance database.
 * Members see every character in the instance except hidden ones (the owner and admins still see those);
 * the owner or an admin can edit, and hide or show it.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cloud, supabase } from "./backend.ts";
import { useSession } from "./session.tsx";
import { deleteCharacter as localDelete, loadCharacters, saveCharacter as localSave } from "./store.tsx";
import { mergeCharacter } from "./merge.ts";
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
  /** The last version of each character known to be saved in the database, and when: what local edits are merged against. */
  const server = useRef<Record<string, { data: Character; at: string }>>({});

  const reload = useCallback(async () => {
    if (!supabase || session.status !== "ready") return;
    const { data, error: e } = await supabase.from("characters").select("id, owner, hidden, data, updated_at").order("updated_at", { ascending: false });
    if (e) {
      setError(e.message);
      return;
    }
    // a character with unsaved edits here keeps them, merged with what's in the database
    const next = (data || []).map((r) => {
      const remote = { ...(r.data as Character), id: r.id };
      const mine = pending.current[r.id];
      const c = mine ? mergeCharacter(server.current[r.id]?.data, mine, remote) : remote;
      if (mine) pending.current[r.id] = c;
      server.current[r.id] = { data: remote, at: r.updated_at };
      return { c, owner: r.owner, hidden: !!r.hidden };
    });
    setRows(next);
    setReady(true);
  }, [session.status]);

  // live changes: another sheet, or the DM's encounter tracker, changed a character
  useEffect(() => {
    if (!cloud || !supabase || session.status !== "ready") return;
    const ch = supabase
      .channel("characters-live")
      .on("postgres_changes", { event: "*", schema: "fivepointfive", table: "characters" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const id = (payload.old as { id?: string }).id;
          if (id) setRows((prev) => prev.filter((r) => r.c.id !== id));
          return;
        }
        const row = payload.new as { id: string; owner: string; hidden: boolean; data: Character; updated_at: string };
        const known = server.current[row.id];
        // our own save coming back
        if (known && Date.parse(known.at) === Date.parse(row.updated_at)) return;
        const remote = { ...row.data, id: row.id };
        const mine = pending.current[row.id];
        const next = mine ? mergeCharacter(known?.data, mine, remote) : remote;
        if (mine) pending.current[row.id] = next;
        server.current[row.id] = { data: remote, at: row.updated_at };
        setRows((prev) => (prev.some((r) => r.c.id === row.id)
          ? prev.map((r) => (r.c.id === row.id ? { c: next, owner: row.owner, hidden: !!row.hidden } : r))
          : [{ c: next, owner: row.owner, hidden: !!row.hidden }, ...prev]));
      })
      .subscribe();
    return () => {
      supabase!.removeChannel(ch);
    };
  }, [session.status]);

  // local mode: a sheet or tracker open in another tab of this browser changed a character
  useEffect(() => {
    if (cloud) return;
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === "fpf.characters") setRows(loadCharacters().map((c) => ({ c })));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

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

  /**
   * Save a character, but only over the version this browser last saw: if someone else saved in between (the DM's
   * tracker, the player's sheet on another device), merge with theirs and try again, so neither change is lost.
   */
  const flush = useCallback(async (id: string) => {
    let c = pending.current[id];
    if (!c || !supabase) return;
    delete pending.current[id];
    setSaving(true);
    for (let tries = 0; tries < 4; tries++) {
      const known = server.current[id];
      const at = new Date().toISOString();
      let q = supabase.from("characters").update({ data: c, updated_at: at }).eq("id", id);
      if (known) q = q.eq("updated_at", known.at);
      const { data, error: e } = await q.select("id");
      if (e) {
        setError(`Couldn’t save: ${e.message}`);
        break;
      }
      if (data && data.length) {
        server.current[id] = { data: c, at };
        break;
      }
      // someone else saved first: take theirs, put our changes on top, and save again
      const { data: latest } = await supabase.from("characters").select("data, updated_at").eq("id", id).maybeSingle();
      if (!latest) break;
      const remote = { ...(latest.data as Character), id };
      const sent = c;
      c = mergeCharacter(known?.data, sent, remote);
      server.current[id] = { data: remote, at: latest.updated_at };
      // edits made here while this save was out started from what we sent: put them on top as well
      if (pending.current[id]) {
        c = mergeCharacter(sent, pending.current[id], c);
        delete pending.current[id];
        clearTimeout(timers.current[id]);
      }
      const merged = c;
      setRows((prev) => prev.map((r) => (r.c.id === id ? { ...r, c: merged } : r)));
    }
    setSaving(Object.keys(pending.current).length > 0);
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
