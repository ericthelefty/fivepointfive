/**
 * Who is signed in and what they can do in this instance.
 * In local-only mode everyone is effectively the admin of their own browser.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { cloud, supabase } from "./backend.ts";

export interface Member {
  user_id: string;
  role: "admin" | "member";
  display_name: string;
  created_at?: string;
}

export interface Settings {
  shared_log: boolean;
  instance_name: string;
  /** Built-in sheet backgrounds an admin has taken out of the picker. */
  hidden_backgrounds: string[];
}

type Status = "loading" | "local" | "signedOut" | "needsInvite" | "empty" | "ready";

interface SessionState {
  status: Status;
  user: User | null;
  me: Member | null;
  members: Member[];
  settings: Settings;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  setSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => Promise<void>;
  nameOf: (userId?: string) => string;
}

const Ctx = createContext<SessionState | null>(null);
const DEFAULT_SETTINGS: Settings = { shared_log: false, instance_name: "fivepointfive", hidden_backgrounds: [] };

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(cloud ? "loading" : "local");
  const [user, setUser] = useState<User | null>(null);
  const [me, setMe] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const { data: s } = await supabase.auth.getSession();
    const u = s.session?.user || null;
    setUser(u);
    if (!u) {
      setStatus("signedOut");
      return;
    }
    const { data: ms } = await supabase.from("members").select("*").order("created_at");
    const list = (ms || []) as Member[];
    const mine = list.find((m) => m.user_id === u.id) || null;
    setMembers(list);
    setMe(mine);
    if (!mine) {
      const { data: st } = await supabase.rpc("instance_status");
      setStatus(st === "empty" ? "empty" : "needsInvite");
      return;
    }
    const { data: rows } = await supabase.from("settings").select("key,value");
    const next = { ...DEFAULT_SETTINGS };
    for (const r of rows || []) (next as Record<string, unknown>)[r.key] = r.value;
    setSettings(next);
    setStatus("ready");
  }, []);

  useEffect(() => {
    if (!supabase) return;
    refresh();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  const signOut = async () => {
    await supabase?.auth.signOut();
    setMe(null);
    setStatus("signedOut");
  };

  const setSetting = async <K extends keyof Settings>(k: K, v: Settings[K]) => {
    if (!supabase) return;
    await supabase.from("settings").update({ value: v }).eq("key", k);
    setSettings((prev) => ({ ...prev, [k]: v }));
  };

  const value: SessionState = {
    status,
    user,
    me,
    members,
    settings,
    isAdmin: !cloud || me?.role === "admin",
    refresh,
    signOut,
    setSetting,
    nameOf: (id) => {
      if (!id) return "";
      const m = members.find((x) => x.user_id === id);
      return m ? m.display_name || "Member" : "Former member";
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const c = useContext(Ctx);
  if (!c) throw new Error("SessionProvider missing");
  return c;
}
