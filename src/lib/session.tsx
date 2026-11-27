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

/** A campaign: a way to divide the players of an instance, and the characters they can see. */
export interface Campaign {
  id: string;
  name: string;
  created_at?: string;
}
export interface CampaignMember {
  campaign_id: string;
  user_id: string;
  role: "player" | "gm";
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
  /** The campaigns this member can see (admins: all of them), by name. */
  campaigns: Campaign[];
  /** Who is in which campaign, and who runs it. */
  campaignMembers: CampaignMember[];
  /** The campaign the Characters list, Encounters and new characters are for ("" = every campaign, admins only). */
  campaignId: string;
  setCampaignId: (id: string) => void;
  /** Is the signed-in member this campaign's GM (admins are GM of every campaign; local mode: always). */
  isGm: (campaignId?: string | null) => boolean;
  /** GM of at least one campaign, or an admin. */
  gmAny: boolean;
  campaignName: (id?: string | null) => string;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  setSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => Promise<void>;
  nameOf: (userId?: string) => string;
}

const Ctx = createContext<SessionState | null>(null);
const DEFAULT_SETTINGS: Settings = { shared_log: false, instance_name: "", hidden_backgrounds: [] };
const CAMPAIGN_KEY = "fpf.campaign";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(cloud ? "loading" : "local");
  const [user, setUser] = useState<User | null>(null);
  const [me, setMe] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignMembers, setCampaignMembers] = useState<CampaignMember[]>([]);
  const [campaignId, setCampaignIdState] = useState<string>(() => { try { return localStorage.getItem(CAMPAIGN_KEY) || ""; } catch { return ""; } });
  const setCampaignId = (id: string) => {
    setCampaignIdState(id);
    try { localStorage.setItem(CAMPAIGN_KEY, id); } catch { /* private mode */ }
  };

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
    const [{ data: cs }, { data: cms }] = await Promise.all([
      supabase.from("campaigns").select("id, name, created_at").order("name"),
      supabase.from("campaign_members").select("campaign_id, user_id, role"),
    ]);
    const clist = (cs || []) as Campaign[];
    setCampaigns(clist);
    setCampaignMembers((cms || []) as CampaignMember[]);
    // keep the chosen campaign if it's still one of theirs; otherwise the first of theirs (admins may choose "every campaign")
    setCampaignIdState((cur) => {
      const ok = clist.some((c) => c.id === cur) || (cur === "" && mine.role === "admin");
      const next = ok ? cur : clist.find((c) => (cms || []).some((m) => m.campaign_id === c.id && m.user_id === u.id))?.id || clist[0]?.id || "";
      try { localStorage.setItem(CAMPAIGN_KEY, next); } catch { /* private mode */ }
      return next;
    });
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
    campaigns,
    campaignMembers,
    campaignId: cloud ? campaignId : "",
    setCampaignId,
    isGm: (cid) => !cloud || me?.role === "admin" || (!!cid && campaignMembers.some((m) => m.campaign_id === cid && m.user_id === user?.id && m.role === "gm")),
    gmAny: !cloud || me?.role === "admin" || campaignMembers.some((m) => m.user_id === user?.id && m.role === "gm"),
    campaignName: (id) => (id ? campaigns.find((c) => c.id === id)?.name || "Another campaign" : ""),
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
