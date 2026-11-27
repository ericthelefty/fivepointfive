/**
 * Loot on a shared instance: the GM sends it, players choose, the database settles each item (rolling a d20 when
 * more than one player wants it), and a won item lands in the winner's Inventory. Everything here is live: choices
 * and results reach every open screen as they happen.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cloud, supabase } from "./backend.ts";
import { useSession } from "./session.tsx";
import { useCharacters } from "./characters.tsx";
import { esc, playOf, timeNow, type LogEntry } from "./play.ts";
import { addCoins, inventoryOf, newItemId, NO_COINS, type Coins } from "./inventory.ts";
import { coinsText, type HiddenFind, type LootLine } from "./loot.ts";
import { useContent } from "./store.tsx";
import { combatTables } from "./encounter.ts";
import type { Character } from "./rules.ts";

export interface LootBody { id: string; name: string; status: string; check: "investigation" | "perception" }
export interface LootRow { id: string; encounter_id?: string; campaign_id?: string | null; name: string; status: "open" | "closed"; players: string[]; created_at: string; bodies: LootBody[]; coins: Partial<Coins>; shared_coins: Partial<Coins> }
export interface LootItemRow { id: string; loot_id: string; seq: number; item: LootLine; status: "open" | "won" | "left"; winner?: string | null; rolls?: Record<string, number>[] | null; delivered: boolean; found_by?: string | null }
export type FoundThing = HiddenFind & { key: string; choice: "keep" | "share" | null; taken?: boolean };
export interface LootSearchRow { id: string; loot_id: string; body_id: string; character_id: string; total: number; detail?: string; finds: FoundThing[]; created_at: string }
export interface LootPayoutRow { loot_id: string; character_id: string; coins: Coins; delivered: boolean }
export interface LootChoiceRow { item_id: string; character_id: string; loot_id: string; choice: "want" | "leave" }

const uid = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);

/** The GM sends the reviewed loot: one line per copy, most valuable first, to the characters in the fight. */
export async function sendLoot(o: {
  encounterId: string; campaignId?: string | null; name: string; players: string[]; lines: LootLine[];
  coins?: Coins; bodies?: LootBody[]; hidden?: { bodyId: string; tiers: { dc: number; finds: HiddenFind[] }[] }[];
}): Promise<string> {
  if (!supabase) throw new Error("Loot needs a shared instance.");
  const id = uid();
  const { error: e1 } = await supabase.from("loot").insert({ id, encounter_id: o.encounterId, campaign_id: o.campaignId ?? null, name: o.name, players: o.players, coins: o.coins || {}, bodies: o.bodies || [] });
  if (e1) throw e1;
  if (o.hidden?.length) {
    const { error: e3 } = await supabase.from("loot_hidden").insert(o.hidden.map((h) => ({ loot_id: id, body_id: h.bodyId, tiers: h.tiers })));
    if (e3) throw e3;
  }
  if (o.lines.length) {
    const { error: e2 } = await supabase.from("loot_items").insert(o.lines.map((item, i) => ({ id: `${id}-${i}`, loot_id: id, seq: i, item })));
    if (e2) throw e2;
  }
  return id;
}

/** Ignore from the pop-up: Leave on every open item this character hasn't answered. */
export async function ignoreLoot(lootId: string, characterId: string) {
  if (!supabase) return;
  const { data } = await supabase.from("loot_items").select("id").eq("loot_id", lootId).eq("status", "open");
  const rows = ((data || []) as { id: string }[]).map((i) => ({ item_id: i.id, character_id: characterId, loot_id: lootId, choice: "leave" }));
  if (rows.length) await supabase.from("loot_choices").upsert(rows, { onConflict: "item_id,character_id", ignoreDuplicates: true });
}

/** One loot, kept live. */
export function useLoot(id?: string) {
  const [loot, setLoot] = useState<LootRow>();
  const [items, setItems] = useState<LootItemRow[]>([]);
  const [choices, setChoices] = useState<LootChoiceRow[]>([]);
  const [searches, setSearches] = useState<LootSearchRow[]>([]);
  const [payouts, setPayouts] = useState<LootPayoutRow[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  const load = useCallback(async () => {
    if (!supabase || !id) return;
    const [l, i, c, s, p] = await Promise.all([
      supabase.from("loot").select("*").eq("id", id).maybeSingle(),
      supabase.from("loot_items").select("*").eq("loot_id", id).order("seq"),
      supabase.from("loot_choices").select("item_id, character_id, loot_id, choice").eq("loot_id", id),
      supabase.from("loot_searches").select("*").eq("loot_id", id).order("created_at"),
      supabase.from("loot_payouts").select("*").eq("loot_id", id),
    ]);
    const err = l.error || i.error || c.error || s.error || p.error;
    if (err) setError(err.message);
    setLoot((l.data as LootRow) || undefined);
    setItems((i.data as LootItemRow[]) || []);
    setChoices((c.data as LootChoiceRow[]) || []);
    setSearches((s.data as LootSearchRow[]) || []);
    setPayouts((p.data as LootPayoutRow[]) || []);
    setReady(true);
  }, [id]);
  useEffect(() => {
    if (!supabase || !id) return;
    load();
    // small tables: any change reloads the lot
    let t: ReturnType<typeof setTimeout> | undefined;
    const soon = () => { clearTimeout(t); t = setTimeout(load, 120); };
    const ch = supabase.channel(`loot-${id}`)
      .on("postgres_changes", { event: "*", schema: "fivepointfive", table: "loot", filter: `id=eq.${id}` }, soon)
      .on("postgres_changes", { event: "*", schema: "fivepointfive", table: "loot_items", filter: `loot_id=eq.${id}` }, soon)
      .on("postgres_changes", { event: "*", schema: "fivepointfive", table: "loot_choices", filter: `loot_id=eq.${id}` }, soon)
      .on("postgres_changes", { event: "*", schema: "fivepointfive", table: "loot_searches", filter: `loot_id=eq.${id}` }, soon)
      .on("postgres_changes", { event: "*", schema: "fivepointfive", table: "loot_payouts", filter: `loot_id=eq.${id}` }, soon)
      .subscribe((s) => { if (s === "SUBSCRIBED") load(); });
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { clearTimeout(t); window.removeEventListener("focus", onFocus); supabase!.removeChannel(ch); };
  }, [id, load]);

  const choose = async (itemId: string, characterId: string, choice: "want" | "leave") => {
    if (!supabase || !id) return;
    setChoices((cur) => [...cur.filter((c) => !(c.item_id === itemId && c.character_id === characterId)), { item_id: itemId, character_id: characterId, loot_id: id, choice }]);
    const { error: e } = await supabase.from("loot_choices").upsert({ item_id: itemId, character_id: characterId, loot_id: id, choice }, { onConflict: "item_id,character_id" });
    if (e) { setError(`Couldn’t save that choice: ${e.message}`); load(); }
  };
  /** Ignore: Leave on every item this character hasn't answered, so the rest of the party can settle it. */
  const ignore = async (characterId: string) => {
    if (!supabase || !id) return;
    const answered = new Set(choices.filter((c) => c.character_id === characterId).map((c) => c.item_id));
    const rows = items.filter((i) => i.status === "open" && !answered.has(i.id)).map((i) => ({ item_id: i.id, character_id: characterId, loot_id: id, choice: "leave" }));
    if (!rows.length) return;
    const { error: e } = await supabase.from("loot_choices").upsert(rows, { onConflict: "item_id,character_id", ignoreDuplicates: true });
    if (e) setError(`Couldn’t leave the loot: ${e.message}`);
    load();
  };
  const close = async () => {
    if (!supabase || !id) return;
    const { error: e } = await supabase.rpc("close_loot", { lid: id });
    if (e) setError(`Couldn’t close the loot: ${e.message}`);
    load();
  };
  /** Search a body with a roll already made on the character's sheet; the database says what it uncovers. */
  const search = async (bodyId: string, characterId: string, total: number, detail: string): Promise<FoundThing[] | undefined> => {
    if (!supabase || !id) return;
    const { data, error: e } = await supabase.rpc("search_body", { lid: id, bid: bodyId, cid: characterId, total, detail });
    if (e) { setError(`Couldn’t search: ${e.message}`); return; }
    load();
    return data as FoundThing[];
  };
  const decide = async (searchId: string, key: string, pick: "keep" | "share") => {
    if (!supabase) return;
    setSearches((cur) => cur.map((x) => (x.id === searchId ? { ...x, finds: x.finds.map((f) => (f.key === key ? { ...f, choice: pick } : f)) } : x)));
    const { error: e } = await supabase.rpc("decide_find", { sid: searchId, k: key, pick });
    if (e) setError(`Couldn’t save that: ${e.message}`);
    load();
  };
  return { loot, items, choices, searches, payouts, ready, error, choose, ignore, close, search, decide, reload: load };
}

const seenKey = (lootId: string, cid: string) => `fpf.loot.seen.${lootId}.${cid}`;
export const markSeen = (lootId: string, cid: string) => { try { localStorage.setItem(seenKey(lootId, cid), "1"); } catch { /* private mode */ } };
const wasSeen = (lootId: string, cid: string) => { try { return localStorage.getItem(seenKey(lootId, cid)) === "1"; } catch { return false; } };

/**
 * Watches for loot that involves this person: the "battle is over" pop-up for each character of theirs in a
 * newly sent loot, and handing won items over to the winner's Inventory (any screen that may edit the winner
 * can do it, once: the database lets exactly one take it).
 */
export function useLootWatch() {
  const session = useSession();
  const chars = useCharacters();
  const [open, setOpen] = useState<LootRow[]>([]);
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [, bump] = useState(0);
  const charsRef = useRef(chars);
  charsRef.current = chars;
  const delivering = useRef(new Set<string>());

  const content = useContent();
  const tables = useMemo(() => combatTables(content.entries), [content.entries]);
  const libRef = useRef({ content, tables });
  libRef.current = { content, tables };

  /** Add things to a character's sheet with a game log line. A sheet still on its starting equipment gets it written out first. */
  const give = useCallback((cid: string, add: { item?: LootLine["item"]; coins?: Partial<Coins> }, title: string, detail: string) => {
    const row = charsRef.current.get(cid);
    if (!row) return;
    const c: Character = row.c;
    if (!c.inventory) void libRef.current.content.ensure("rules", "items");
    const { content: ct, tables: tb } = libRef.current;
    const inv = inventoryOf(c, ct.byId(c.classId), ct.byId(c.backgroundId), tb.catalog);
    const p = playOf(c);
    const line: LogEntry = { id: newItemId(), t: timeNow(), cls: "info", total: "", title, detail };
    charsRef.current.save({
      ...c,
      inventory: add.item ? [...inv.items, { ...add.item, id: newItemId(), qty: 1, equipped: undefined }] : inv.items,
      coins: add.coins ? addCoins(inv.coins, { ...NO_COINS, ...add.coins }) : inv.coins,
      play: { ...p, log: [line, ...p.log].slice(0, 150) },
    });
  }, []);

  const deliver = useCallback(async () => {
    if (!supabase) return;
    const nameOf = (cid: string) => charsRef.current.get(cid)?.c.name || "someone";
    const lootNames = new Map<string, string>();
    const lootName = async (lid: string) => {
      if (!lootNames.has(lid)) {
        const { data: lt } = await supabase!.from("loot").select("name").eq("id", lid).maybeSingle();
        lootNames.set(lid, lt?.name || "encounter");
      }
      return esc(lootNames.get(lid)!);
    };
    // items won on the loot list
    const { data } = await supabase.from("loot_items").select("*").eq("status", "won").eq("delivered", false);
    for (const it of (data || []) as LootItemRow[]) {
      if (!it.winner || !charsRef.current.canEdit(it.winner) || delivering.current.has(it.id)) continue;
      delivering.current.add(it.id);
      const { data: ok } = await supabase.rpc("take_delivery", { iid: it.id });
      if (ok !== true) continue;
      const last = it.rolls?.[it.rolls.length - 1];
      const how = last ? `d20 ${last[it.winner]} vs ${Object.entries(last).filter(([k]) => k !== it.winner).map(([k, v]) => `${v} (${esc(nameOf(k))})`).join(", ")}` : "the only one who wanted it";
      give(it.winner, { item: it.item.item }, `Got ${it.item.name}`, `From the ${await lootName(it.loot_id)} loot · ${how}. It’s in your Inventory.`);
    }
    // finds the finder kept
    const { data: ss } = await supabase.from("loot_searches").select("*");
    for (const sr of (ss || []) as LootSearchRow[]) {
      if (!charsRef.current.canEdit(sr.character_id)) continue;
      for (const f of sr.finds) {
        const key = `${sr.id}:${f.key}`;
        if (f.choice !== "keep" || f.taken || delivering.current.has(key)) continue;
        delivering.current.add(key);
        const { data: ok } = await supabase.rpc("take_find", { sid: sr.id, k: f.key });
        if (ok !== true) continue;
        const body = sr.body_id;
        const { data: lt } = await supabase.from("loot").select("bodies").eq("id", sr.loot_id).maybeSingle();
        const bname = ((lt?.bodies || []) as LootBody[]).find((b) => b.id === body)?.name || "the body";
        if (f.kind === "coins") give(sr.character_id, { coins: f.coins }, `Kept ${coinsText(f.coins)}`, `Found searching the ${esc(bname)} (${await lootName(sr.loot_id)}). It’s in your coin purse.`);
        else give(sr.character_id, { item: f.line.item }, `Kept ${f.line.name}`, `Found searching the ${esc(bname)} (${await lootName(sr.loot_id)}). It’s in your Inventory.`);
      }
    }
    // shares of the coin pot
    const { data: ps } = await supabase.from("loot_payouts").select("*").eq("delivered", false);
    for (const po of (ps || []) as LootPayoutRow[]) {
      const key = `pay:${po.loot_id}:${po.character_id}`;
      if (!charsRef.current.canEdit(po.character_id) || delivering.current.has(key)) continue;
      delivering.current.add(key);
      const { data: ok } = await supabase.rpc("take_payout", { lid: po.loot_id, cid: po.character_id });
      if (ok !== true) continue;
      give(po.character_id, { coins: po.coins }, `Got ${coinsText(po.coins)}`, `Your share of the coins from the ${await lootName(po.loot_id)} loot. It’s in your coin purse.`);
    }
  }, [give]);

  const load = useCallback(async () => {
    if (!supabase || session.status !== "ready") return;
    const { data } = await supabase.from("loot").select("*").eq("status", "open").order("created_at", { ascending: false });
    const list = (data || []) as LootRow[];
    setOpen(list);
    if (list.length) {
      const { data: ch } = await supabase.from("loot_choices").select("loot_id, character_id").in("loot_id", list.map((l) => l.id));
      setAnswered(new Set(((ch || []) as { loot_id: string; character_id: string }[]).map((c) => `${c.loot_id}:${c.character_id}`)));
    }
    deliver();
  }, [session.status, deliver]);

  useEffect(() => {
    if (!cloud || !supabase || session.status !== "ready") return;
    load();
    const ch = supabase.channel("loot-watch")
      .on("postgres_changes", { event: "*", schema: "fivepointfive", table: "loot" }, () => load())
      .on("postgres_changes", { event: "UPDATE", schema: "fivepointfive", table: "loot_items" }, () => deliver())
      .on("postgres_changes", { event: "UPDATE", schema: "fivepointfive", table: "loot_searches" }, () => deliver())
      .on("postgres_changes", { event: "INSERT", schema: "fivepointfive", table: "loot_payouts" }, () => deliver())
      .subscribe();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { window.removeEventListener("focus", onFocus); supabase!.removeChannel(ch); };
  }, [session.status, load, deliver]);

  const me = session.user?.id;
  /** Pop-ups to show: a newly sent loot, for each of this person's own characters in it they haven't answered or dismissed. */
  const popups = open.flatMap((l) => l.players
    .filter((cid) => chars.get(cid)?.owner === me && !answered.has(`${l.id}:${cid}`) && !wasSeen(l.id, cid))
    .map((cid) => ({ loot: l, characterId: cid, characterName: chars.get(cid)?.c.name || "your character" })));
  return { popups, dismiss: (lootId: string, cid: string) => { markSeen(lootId, cid); bump((n) => n + 1); } };
}
