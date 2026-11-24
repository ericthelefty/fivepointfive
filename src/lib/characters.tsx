/**
 * Characters, from browser storage (local mode) or the instance database.
 * Members see every character in the instance except hidden ones (the owner and admins still see those);
 * the owner or an admin can edit, and hide or show it.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cloud, supabase } from "./backend.ts";
import { useSession } from "./session.tsx";
import { removeCharacterBackgrounds } from "./backgrounds.ts";
import { deleteCharacter as localDelete, loadCharacters, saveCharacter as localSave } from "./store.tsx";
import { mergeCharacter } from "./merge.ts";
import { applyOps, diff, type Op } from "./patch.ts";
import type { LogEntry, PlayState } from "./play.ts";
import type { Character } from "./rules.ts";
import type { RealtimeChannel } from "@supabase/supabase-js";

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
  /** Admins: give a character to another member, who then owns it as if they had made it. */
  assign: (id: string, owner: string) => Promise<boolean>;
  reload: () => Promise<void>;
  saving: boolean;
  error?: string;
}

const Ctx = createContext<CharState | null>(null);

/** A character as saved in the database: its game log lives in its own table (`character_log`). */
const stripLog = (c: Character): Character => {
  if (!c.play || !("log" in c.play)) return c;
  const { log: _log, ...play } = c.play as PlayState;
  return { ...c, play: play as PlayState };
};
const logOf = (c?: Character): LogEntry[] => ((c?.play as PlayState | undefined)?.log || []);
const withLog = (c: Character, log: LogEntry[]): Character => ({ ...c, play: { ...(c.play || {}), log } as PlayState });
/** `log` plus any entries of `extra` it doesn't have, those first (they arrived from elsewhere, so they're newer). */
const addEntries = (log: LogEntry[], extra: LogEntry[]): LogEntry[] => {
  const have = new Set(log.map((e) => e.id));
  const add = extra.filter((e) => !have.has(e.id));
  return add.length ? [...add, ...log].slice(0, 150) : log;
};
const TOPIC = "fivepointfive:characters";
/** How often an open app checks it hasn't missed a change (it also checks on focus, when a phone wakes and on reconnect). */
const CHECK_MS = 60_000;

type DbRow = { id: string; owner: string; hidden: boolean; data: Character; version: number };
type LogRow = { character_id: string; id: string; seq: number; entry: LogEntry };
/** A small live update: what changed in one character, and the version it turns into which. */
type Patch = { id: string; base?: number; v: number; ops?: Op[] };

export function CharactersProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const [rows, setRows] = useState<CharRow[]>(() => (cloud ? [] : loadCharacters().map((c) => ({ c }))));
  const [ready, setReady] = useState(!cloud);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pending = useRef<Record<string, Character>>({});
  /** The last version of each character known to be saved in the database (with its log): what local edits are merged against. */
  const server = useRef<Record<string, { data: Character; v: number }>>({});
  /** Game log entries known to be in the database, by character, and the newest entry number seen. */
  const logIds = useRef<Record<string, Set<string>>>({});
  const logHead = useRef<Record<string, number>>({});
  /** Entries that arrived from elsewhere since this browser last saved that character (kept if a save races them). */
  const fresh = useRef<Record<string, LogEntry[]>>({});
  const live = useRef<RealtimeChannel | null>(null);
  const hiddenOf = useRef<Record<string, boolean>>({});

  /** Turn database rows (and their logs) into characters, keeping this browser's unsaved edits. */
  const absorb = useCallback((list: DbRow[], logs: LogRow[], keepLogs = false): CharRow[] => {
    const byChar: Record<string, LogEntry[]> = {};
    for (const l of logs) {
      (byChar[l.character_id] ||= []).push(l.entry);
      (logIds.current[l.character_id] ||= new Set()).add(l.id);
      logHead.current[l.character_id] = Math.max(logHead.current[l.character_id] || 0, l.seq);
    }
    return list.map((r) => {
      // a copy of the log still inside the character (saved by an older version of the app) is merged in, and moved out on the next save
      const log = addEntries(keepLogs ? logOf(server.current[r.id]?.data) : byChar[r.id] || [], logOf(r.data));
      const remote = withLog({ ...stripLog(r.data), id: r.id }, log);
      const mine = pending.current[r.id];
      const c = mine ? mergeCharacter(server.current[r.id]?.data, mine, remote) : remote;
      if (mine) pending.current[r.id] = c;
      server.current[r.id] = { data: remote, v: r.version };
      hiddenOf.current[r.id] = !!r.hidden;
      return { c, owner: r.owner, hidden: !!r.hidden };
    });
  }, []);

  const reload = useCallback(async () => {
    if (!supabase || session.status !== "ready") return;
    const [{ data, error: e }, { data: logs, error: le }] = await Promise.all([
      supabase.from("characters").select("id, owner, hidden, data, version").order("updated_at", { ascending: false }),
      supabase.rpc("recent_log", { per_character: 150 }),
    ]);
    if (e || le) {
      setError((e || le)!.message);
      return;
    }
    setRows(absorb((data || []) as DbRow[], (logs || []) as LogRow[]));
    setReady(true);
  }, [session.status, absorb]);

  /** Fetch fresh full copies of some characters (a missed update, a new or changed row). */
  const refetch = useCallback(async (ids: string[], withLogs = true) => {
    if (!supabase || !ids.length) return;
    const [{ data }, logs] = await Promise.all([
      supabase.from("characters").select("id, owner, hidden, data, version").in("id", ids),
      withLogs ? supabase.rpc("recent_log", { per_character: 150, ids }) : Promise.resolve({ data: [] }),
    ]);
    if (!data) return;
    if (withLogs) for (const id of ids) logIds.current[id] = new Set();
    const got = absorb(data as DbRow[], ((logs as { data: unknown }).data || []) as LogRow[], !withLogs);
    setRows((prev) => {
      let next = prev.filter((r) => !ids.includes(r.c.id) || got.some((g) => g.c.id === r.c.id));
      for (const g of got) next = next.some((r) => r.c.id === g.c.id) ? next.map((r) => (r.c.id === g.c.id ? g : r)) : [g, ...next];
      return next;
    });
  }, [absorb]);

  /** A changed character arrived (a patch or a refetch): merge it with unsaved edits here and show it. */
  const integrate = useCallback((id: string, remote: Character, v: number) => {
    const known = server.current[id];
    const mine = pending.current[id];
    const next = mine ? mergeCharacter(known?.data, mine, remote) : remote;
    if (mine) pending.current[id] = next;
    server.current[id] = { data: remote, v };
    setRows((prev) => prev.map((r) => (r.c.id === id ? { ...r, c: next } : r)));
  }, []);

  /** A log entry or a removal arrived: apply it to every copy of that character this browser holds. */
  const editLog = useCallback((id: string, f: (log: LogEntry[]) => LogEntry[]) => {
    const k = server.current[id];
    if (k) server.current[id] = { ...k, data: withLog(k.data, f(logOf(k.data))) };
    if (pending.current[id]) pending.current[id] = withLog(pending.current[id], f(logOf(pending.current[id])));
    setRows((prev) => prev.map((r) => (r.c.id === id ? { ...r, c: withLog(r.c, f(logOf(r.c))) } : r)));
  }, []);

  /** The occasional check: compare version numbers (a few bytes) and fetch only what's out of date. */
  const check = useCallback(async () => {
    if (!supabase || session.status !== "ready") return;
    const [{ data }, { data: heads }] = await Promise.all([
      supabase.from("characters").select("id, version"),
      supabase.rpc("log_heads"),
    ]);
    if (!data) return;
    const live = new Set(data.map((r) => r.id as string));
    const gone = Object.keys(server.current).filter((id) => !live.has(id));
    if (gone.length) {
      for (const id of gone) delete server.current[id];
      setRows((prev) => prev.filter((r) => !gone.includes(r.c.id)));
    }
    const stale = data.filter((r) => server.current[r.id]?.v !== r.version).map((r) => r.id as string);
    const logStale = ((heads || []) as { character_id: string; head: number }[]).filter((h) => (logHead.current[h.character_id] || 0) < h.head).map((h) => h.character_id);
    const ids = [...new Set([...stale, ...logStale])].filter((id) => !pending.current[id]);
    if (ids.length) await refetch(ids);
  }, [session.status, refetch]);

  // live changes: small patches from other sheets, new log entries, and characters added or deleted
  useEffect(() => {
    if (!cloud || !supabase || session.status !== "ready") return;
    let joined = false;
    const rows$ = supabase
      .channel("characters-live")
      .on("postgres_changes", { event: "INSERT", schema: "fivepointfive", table: "characters" }, (payload) => {
        const r = payload.new as DbRow;
        if (!server.current[r.id]) refetch([r.id]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "fivepointfive", table: "characters" }, (payload) => {
        const id = (payload.old as { id?: string }).id;
        if (!id) return;
        delete server.current[id];
        setRows((prev) => prev.filter((r) => r.c.id !== id));
      })
      .on("postgres_changes", { event: "INSERT", schema: "fivepointfive", table: "character_log" }, (payload) => {
        const l = payload.new as LogRow;
        logHead.current[l.character_id] = Math.max(logHead.current[l.character_id] || 0, l.seq);
        const ids = (logIds.current[l.character_id] ||= new Set());
        if (ids.has(l.id)) return; // one of ours
        ids.add(l.id);
        (fresh.current[l.character_id] ||= []).unshift(l.entry);
        editLog(l.character_id, (log) => addEntries(log, [l.entry]));
      })
      .on("postgres_changes", { event: "DELETE", schema: "fivepointfive", table: "character_log" }, (payload) => {
        const o = payload.old as { character_id?: string; id?: string };
        if (!o.character_id || !o.id) return;
        logIds.current[o.character_id]?.delete(o.id);
        editLog(o.character_id, (log) => log.filter((e) => e.id !== o.id));
      })
      .subscribe((status) => {
        // back after a dropped connection: catch up on anything missed
        if (status === "SUBSCRIBED") { if (joined) check(); joined = true; }
      });
    const patches = supabase
      .channel(TOPIC, { config: { private: true, broadcast: { self: false } } })
      .on("broadcast", { event: "patch" }, ({ payload }) => {
        const pt = payload as Patch;
        const known = server.current[pt.id];
        if (!known) { refetch([pt.id]); return; }
        if (pt.v <= known.v) return; // already have it
        if (pt.ops && pt.base === known.v) integrate(pt.id, withLog(applyOps(stripLog(known.data), pt.ops), logOf(known.data)), pt.v);
        else refetch([pt.id], false); // missed one in between (or a change that isn't sent as a patch): fetch a fresh copy
      })
      .subscribe();
    live.current = patches;
    return () => {
      live.current = null;
      supabase!.removeChannel(rows$);
      supabase!.removeChannel(patches);
    };
  }, [session.status, refetch, integrate, editLog, check]);

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

  // the occasional check: on focus, when a phone wakes the page, and once a minute while it's on screen
  useEffect(() => {
    if (!cloud) return;
    const onFocus = () => check();
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    const t = setInterval(() => { if (document.visibilityState === "visible") check(); }, CHECK_MS);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  /** Tell other open sheets what changed. A hidden character's contents aren't sent: they fetch it if they're allowed to see it. */
  const announce = (pt: Patch) => {
    const ch = live.current;
    if (!ch) return;
    const body = hiddenOf.current[pt.id] ? { id: pt.id, v: pt.v } : pt;
    ch.send({ type: "broadcast", event: "patch", payload: body }).catch(() => { /* others catch up on their next check */ });
  };

  /** Save new game log entries as rows of their own, or clear them. */
  const syncLog = async (id: string, c: Character) => {
    const ids = (logIds.current[id] ||= new Set());
    const log = logOf(c);
    if (!log.length) {
      if (!ids.size) return;
      const { error: e } = await supabase!.from("character_log").delete().eq("character_id", id);
      if (e) setError(`Couldn’t clear the game log: ${e.message}`);
      else ids.clear();
      return;
    }
    const add = log.filter((e) => !ids.has(e.id));
    if (!add.length) return;
    // oldest first, so their order is kept
    const { data, error: e } = await supabase!.from("character_log")
      .upsert([...add].reverse().map((entry) => ({ character_id: id, id: entry.id, entry })), { onConflict: "character_id,id", ignoreDuplicates: true })
      .select("id, seq");
    if (e) { setError(`Couldn’t save the game log: ${e.message}`); return; }
    for (const r of add) ids.add(r.id);
    for (const r of (data || []) as { seq: number }[]) logHead.current[id] = Math.max(logHead.current[id] || 0, r.seq);
  };

  /**
   * Save a character, but only over the version this browser last saw: if someone else saved in between (the GM's
   * tracker, the player's sheet on another device), merge with theirs and try again, so neither change is lost.
   * Then tell other open sheets what changed, in a few bytes.
   */
  const flush = useCallback(async (id: string) => {
    let c = pending.current[id];
    if (!c || !supabase) return;
    delete pending.current[id];
    setSaving(true);
    await syncLog(id, c);
    for (let tries = 0; tries < 4; tries++) {
      const known = server.current[id];
      let q = supabase.from("characters").update({ data: stripLog(c), updated_at: new Date().toISOString() }).eq("id", id);
      if (known) q = q.eq("version", known.v);
      const { data, error: e } = await q.select("version");
      if (e) {
        setError(`Couldn’t save: ${e.message}`);
        break;
      }
      if (data && data.length) {
        const v = (data[0] as { version: number }).version;
        const ops = known ? diff(stripLog(known.data), stripLog(c)) : undefined;
        server.current[id] = { data: c, v };
        announce({ id, base: known?.v, v, ops });
        break;
      }
      // someone else saved first: take theirs, put our changes on top, and save again
      const { data: latest } = await supabase.from("characters").select("data, version").eq("id", id).maybeSingle();
      if (!latest) break;
      const remote = withLog({ ...stripLog(latest.data as Character), id }, logOf(known?.data ?? c));
      const sent = c;
      c = mergeCharacter(known?.data, sent, remote);
      server.current[id] = { data: remote, v: latest.version as number };
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    let next = { ...c, updated: Date.now() };
    // a log entry that arrived from elsewhere a moment before this edit was made isn't dropped (unless the log was just cleared)
    const fr = fresh.current[c.id];
    if (cloud && fr?.length) {
      if (logOf(next).length) next = withLog(next, addEntries(logOf(next), fr));
      delete fresh.current[c.id];
    }
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
    const { error: e } = await supabase!.from("characters").insert({ id: c.id, data: stripLog(c) });
    if (e) {
      setError(`Couldn’t create character: ${e.message}`);
      throw e;
    }
    server.current[c.id] = { data: c, v: 0 };
    logIds.current[c.id] = new Set();
    // an imported character brings its game log with it
    if (logOf(c).length) await syncLog(c.id, c);
    setRows((prev) => [{ c, owner: session.user?.id }, ...prev]);
  };

  const remove = async (id: string) => {
    if (!cloud) localDelete(id);
    else {
      // its uploaded sheet background goes too (while the character still exists, so the storage rules allow it)
      await removeCharacterBackgrounds(id).catch(() => undefined);
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

  const assign = async (id: string, owner: string) => {
    if (!supabase) return false;
    const before = rows.find((r) => r.c.id === id)?.owner;
    setRows((prev) => prev.map((r) => (r.c.id === id ? { ...r, owner } : r)));
    const { data, error: e } = await supabase.from("characters").update({ owner }).eq("id", id).select("id");
    if (e || !data?.length) {
      setError(`Couldn’t assign the character: ${e?.message || "only admins can give a character to another player"}`);
      setRows((prev) => prev.map((r) => (r.c.id === id ? { ...r, owner: before } : r)));
      return false;
    }
    return true;
  };

  return (
    <Ctx.Provider value={{ ready, rows, get: (id) => rows.find((r) => r.c.id === id), save, create, remove, canEdit, setHidden, assign, reload, saving, error }}>
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
