/**
 * Encounters, from browser storage (local mode) or the instance database, where only admins (the GM) can see them.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cloud, supabase } from "./backend.ts";
import { useSession } from "./session.tsx";
import type { Encounter } from "./encounter.ts";

const KEY = "fpf.encounters";

function loadLocal(): Encounter[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
function saveLocal(list: Encounter[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full or unavailable */
  }
}

interface EncState {
  ready: boolean;
  /** Whether this person can use encounters: anyone in local mode, the admin on an instance. */
  allowed: boolean;
  list: Encounter[];
  get: (id?: string) => Encounter | undefined;
  save: (e: Encounter) => void;
  /** Change an encounter from its latest state, so several changes in one click all land. Keep `fn` free of side effects. */
  update: (id: string, fn: (cur: Encounter) => Partial<Encounter>, opts?: { hold?: boolean }) => void;
  /** Encounters with changes held back (Build tab edits) until the GM saves them. */
  dirty: Set<string>;
  /** Save the held changes now. */
  commit: (id: string) => void;
  /** Throw away the held changes and go back to the last saved version. */
  revert: (id: string) => Promise<void>;
  create: (e: Encounter) => Promise<void>;
  remove: (id: string) => Promise<void>;
  error?: string;
}

const Ctx = createContext<EncState | null>(null);

export function EncountersProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  // the admin, and the GM of any campaign (who sees that campaign's encounters only)
  const allowed = !cloud || (session.status === "ready" && session.gmAny);
  const [list, setList] = useState<Encounter[]>(() => (cloud ? [] : loadLocal()));
  const [ready, setReady] = useState(!cloud);
  const [error, setError] = useState<string>();
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pending = useRef<Record<string, Encounter>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const markDirty = (id: string, on: boolean) => setDirty((d) => { if (d.has(id) === on) return d; const n = new Set(d); if (on) n.add(id); else n.delete(id); return n; });

  useEffect(() => {
    if (!cloud) return;
    if (!allowed || !supabase) {
      setList([]);
      setReady(session.status === "ready");
      return;
    }
    supabase.from("encounters").select("id, data, campaign_id, updated_at").order("updated_at", { ascending: false }).then(({ data, error: e }) => {
      if (e) setError(e.message.includes("campaign_id") ? "Encounters need a database update: run supabase/migrations/0012_campaigns.sql (see docs/SELF_HOSTING.md)." : e.message.includes("encounters") ? "Encounters need a database update: run supabase/migrations/0003_encounters.sql (see docs/SELF_HOSTING.md)." : e.message);
      else setList((data || []).map((r) => ({ ...(r.data as Encounter), id: r.id, campaignId: r.campaign_id as string | null })));
      setReady(true);
    });
  }, [allowed, session.status, session.campaigns]);

  const flush = useCallback(async (id: string) => {
    const e = pending.current[id];
    if (!e || !supabase) return;
    delete pending.current[id];
    const { error: err } = await supabase.from("encounters").update({ data: { ...e, campaignId: undefined }, updated_at: new Date().toISOString() }).eq("id", id);
    if (err) setError(`Couldn’t save the encounter: ${err.message}`);
  }, []);

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

  const save = (e: Encounter) => {
    const next = { ...e, updated: Date.now() };
    setList((prev) => {
      const all = prev.map((x) => (x.id === e.id ? next : x));
      if (!cloud) saveLocal(all);
      return all;
    });
    if (!cloud) return;
    pending.current[e.id] = next;
    clearTimeout(timers.current[e.id]);
    timers.current[e.id] = setTimeout(() => flush(e.id), 500);
  };

  const update = (id: string, fn: (cur: Encounter) => Partial<Encounter>, opts?: { hold?: boolean }) => {
    markDirty(id, !!opts?.hold);
    setList((prev) => {
      const cur = prev.find((x) => x.id === id);
      if (!cur) return prev;
      const next = { ...cur, ...fn(cur), updated: Date.now() };
      const all = prev.map((x) => (x.id === id ? next : x));
      if (opts?.hold) return all; // held until the GM saves (or thrown away)
      if (!cloud) saveLocal(all);
      else {
        pending.current[id] = next;
        clearTimeout(timers.current[id]);
        timers.current[id] = setTimeout(() => flush(id), 500);
      }
      return all;
    });
  };

  const commit = (id: string) => {
    markDirty(id, false);
    setList((prev) => {
      const cur = prev.find((x) => x.id === id);
      if (!cur) return prev;
      if (!cloud) saveLocal(prev);
      else {
        pending.current[id] = cur;
        clearTimeout(timers.current[id]);
        flush(id);
      }
      return prev;
    });
  };

  const revert = async (id: string) => {
    let saved: Encounter | undefined;
    if (!cloud) saved = loadLocal().find((x) => x.id === id);
    else if (supabase) {
      const { data } = await supabase.from("encounters").select("id, data, campaign_id").eq("id", id).maybeSingle();
      if (data) saved = { ...(data.data as Encounter), id: data.id, campaignId: data.campaign_id as string | null };
    }
    if (!saved) return;
    markDirty(id, false);
    setList((prev) => prev.map((x) => (x.id === id ? saved! : x)));
  };

  const create = async (e: Encounter) => {
    if (cloud) {
      // a new encounter is for the campaign chosen at the top of the page
      e = { ...e, campaignId: e.campaignId ?? (session.campaignId || null) };
      const { campaignId, ...data } = e;
      const { error: err } = await supabase!.from("encounters").insert({ id: e.id, data, campaign_id: campaignId });
      if (err) {
        setError(`Couldn’t create the encounter: ${err.message}`);
        throw err;
      }
    }
    setList((prev) => {
      const all = [e, ...prev];
      if (!cloud) saveLocal(all);
      return all;
    });
  };

  const remove = async (id: string) => {
    if (cloud) {
      const { error: err } = await supabase!.from("encounters").delete().eq("id", id);
      if (err) {
        setError(`Couldn’t delete: ${err.message}`);
        return;
      }
    }
    setList((prev) => {
      const all = prev.filter((x) => x.id !== id);
      if (!cloud) saveLocal(all);
      return all;
    });
  };

  return <Ctx.Provider value={{ ready, allowed, list, get: (id) => list.find((x) => x.id === id), save, update, dirty, commit, revert, create, remove, error }}>{children}</Ctx.Provider>;
}

export function useEncounters(): EncState {
  const c = useContext(Ctx);
  if (!c) throw new Error("EncountersProvider missing");
  return c;
}
