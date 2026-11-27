/**
 * Campaigns: a way to divide the players of an instance. Members see only the players, characters, shared rolls,
 * encounters and loot of their own campaigns. The admin creates campaigns, adds members and can make one of them the
 * campaign's GM, who then runs its encounters and loot, adds other members of the instance to it as players and takes
 * players out. Everyone sees the campaigns they're in, and each campaign's page shows everyone in it and their characters.
 *
 * Laid out like a campaign list and campaign page: a card per campaign (players, your role, its GM), then the campaign's
 * own page with its description, the GM's notes (public, and private for the GM), its members and its active characters.
 */
import { useEffect, useState } from "react";
import { Md } from "../lib/md.tsx";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/backend.ts";
import { useSession, type Campaign } from "../lib/session.tsx";
import { useCharacters } from "../lib/characters.tsx";
import { useContent } from "../lib/store.tsx";
import { classInfos, classLabel } from "../lib/multiclass.ts";
import { useCharacterBackdrop } from "../lib/backgrounds.ts";
import type { CharRow } from "../lib/characters.tsx";
import { CampaignMaps } from "./Maps.tsx";

type Run = (what: string, f: () => PromiseLike<{ error: { message: string } | null }>) => Promise<boolean>;

/** Save a change, then refresh who's in which campaign and the characters (which may now be visible or not). */
function useRun(setMsg: (m: string) => void): Run {
  const session = useSession();
  const chars = useCharacters();
  return async (what, f) => {
    const { error } = await f();
    setMsg(error ? `Couldn’t ${what}: ${error.message}` : "");
    await session.refresh();
    await chars.reload();
    return !error;
  };
}

const started = (c: Campaign) => (c.created_at ? new Date(c.created_at).toLocaleDateString() : "");
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

// ===================================================================== the list
export default function Campaigns() {
  const session = useSession();
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const run = useRun(setMsg);
  const nav = useNavigate();
  const admin = session.isAdmin;
  const mineIds = new Set(session.campaignMembers.filter((m) => m.user_id === session.user?.id).map((m) => m.campaign_id));
  const list = admin ? session.campaigns : session.campaigns.filter((c) => mineIds.has(c.id));

  const create = async () => {
    const n = name.trim();
    if (!n || !supabase) return;
    // the admin who makes it is in it, so it shows up in their picker
    const { data, error } = await supabase.from("campaigns").insert({ name: n }).select("id").single();
    if (error || !data) { setMsg(`Couldn’t create the campaign: ${error?.message}`); return; }
    await supabase.from("campaign_members").insert({ campaign_id: data.id, user_id: session.user!.id });
    setName("");
    await session.refresh();
    session.setCampaignId(data.id as string);
    nav(`/campaigns/${data.id}`);
  };

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div>
        <h1>Campaigns</h1>
        <p className="muted" style={{ margin: "6px 0 0", maxWidth: 760 }}>
          {admin
            ? "Each campaign is its own group: its players see only each other, the characters in the campaign, its shared rolls, encounters and loot. Open a campaign to see everyone in it, add members, pick its GM and see its characters. You see every campaign."
            : "The campaigns you’re in. You see the players, characters, shared rolls, encounters and loot of these campaigns only. Open one to see everyone in it."}
        </p>
      </div>
      {msg && <div className="inset" role="status">{msg}</div>}
      {admin && (
        <form className="panel" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: 14 }} onSubmit={(e) => { e.preventDefault(); create(); }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", flex: "1 1 260px" }}>
            <span className="muted">New campaign</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" style={{ flex: 1 }} />
          </label>
          <button className="btn primary" disabled={!name.trim()}>Create campaign</button>
        </form>
      )}
      {list.length === 0 && <div className="panel muted">{admin ? "No campaigns yet." : "You’re not in a campaign yet. Ask the admin or a GM to add you to one. Until then, you see only your own characters."}</div>}
      <div className="campgrid">
        {list.map((c) => <CampaignCard key={c.id} c={c} run={run} />)}
      </div>
    </div>
  );
}

function CampaignCard({ c, run }: { c: Campaign; run: Run }) {
  const session = useSession();
  const db = supabase!;
  const inIt = session.campaignMembers.filter((m) => m.campaign_id === c.id);
  const me = inIt.find((m) => m.user_id === session.user?.id);
  const gms = inIt.filter((m) => m.role === "gm");
  const players = inIt.filter((m) => m.role === "player").length;
  const role = me?.role === "gm" ? "GM" : me ? "Player" : session.isAdmin ? "Admin (not in it)" : "";
  return (
    <section className="panel campcard">
      <div className="campfaces" aria-hidden="true">{inIt.slice(0, 6).map((m) => <span key={m.user_id} className="campface">{initials(session.nameOf(m.user_id))}</span>)}</div>
      <h2>{c.name || "Unnamed campaign"}</h2>
      {started(c) && <div className="faint">Campaign started {started(c)}</div>}
      <div className="campcount"><b>{players}</b><span>Player{players === 1 ? "" : "s"}</span></div>
      <div className="camprole">
        {role && <>Your role: <b>{role}</b></>}
        {gms.length > 0 && (me?.role !== "gm" || gms.length > 1) && <> · GM: {gms.map((g) => (g.user_id === session.user?.id ? "you" : session.nameOf(g.user_id))).join(", ")}</>}
      </div>
      <div className="campbtns">
        <Link className="btn small primary" to={`/campaigns/${c.id}`}>View campaign</Link>
        {session.campaignId !== c.id
          ? <button className="btn small" onClick={() => session.setCampaignId(c.id)} title="Show this campaign’s characters and encounters on those pages">Show its characters</button>
          : <span className="tag ok" title="The Characters and Encounters pages show this campaign">Showing</span>}
        {session.isAdmin && <button className="btn small" onClick={() => {
          if (confirm(`Delete the campaign ${c.name || ""}? Its encounters, loot and shared rolls go with it. Its characters stay with their players, in no campaign.`)) run("delete the campaign", () => db.from("campaigns").delete().eq("id", c.id));
        }}>Delete</button>}
      </div>
    </section>
  );
}

// ===================================================================== one campaign
export function CampaignPage() {
  const { id } = useParams();
  const session = useSession();
  const chars = useCharacters();
  const [msg, setMsg] = useState("");
  const run = useRun(setMsg);
  const [rename, setRename] = useState<string>();
  const [add, setAdd] = useState("");
  const db = supabase!;
  const c = session.campaigns.find((x) => x.id === id);
  if (!c) return <div className="panel">{session.status === "ready" ? <>This campaign doesn’t exist, or you’re not in it. <Link to="/campaigns">All campaigns</Link></> : "Loading…"}</div>;

  const admin = session.isAdmin;
  const gm = session.isGm(c.id);
  const inIt = session.campaignMembers.filter((m) => m.campaign_id === c.id)
    .sort((a, b) => (a.role === b.role ? session.nameOf(a.user_id).localeCompare(session.nameOf(b.user_id)) : a.role === "gm" ? -1 : 1));
  const gms = inIt.filter((m) => m.role === "gm");
  const others = session.members.filter((m) => !inIt.some((x) => x.user_id === m.user_id));
  const rows = chars.rows.filter((r) => r.campaignId === c.id).sort((a, b) => (a.c.name || "").localeCompare(b.c.name || ""));
  const nameOf = (uid: string) => (uid === session.user?.id ? "You" : session.nameOf(uid));
  const charsOf = (uid: string) => rows.filter((r) => r.owner === uid);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div><Link to="/campaigns" className="faint">← All campaigns</Link></div>
      <div className="camphead">
        {rename !== undefined ? (
          <form style={{ display: "flex", gap: 6, flex: 1 }} onSubmit={(e) => { e.preventDefault(); const n = rename.trim(); setRename(undefined); if (n && n !== c.name) run("rename the campaign", () => db.from("campaigns").update({ name: n }).eq("id", c.id)); }}>
            <input autoFocus value={rename} onChange={(e) => setRename(e.target.value)} aria-label="Campaign name" style={{ flex: 1 }} />
            <button className="btn small primary">Save</button>
            <button type="button" className="btn small" onClick={() => setRename(undefined)}>Cancel</button>
          </form>
        ) : <h1 style={{ margin: 0 }}>{c.name || "Unnamed campaign"}</h1>}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {session.campaignId !== c.id
            ? <button className="btn small" onClick={() => session.setCampaignId(c.id)} title="Show this campaign’s characters and encounters on those pages">Show its characters</button>
            : <span className="tag ok">Showing on Characters{gm ? " and Encounters" : ""}</span>}
          {gm && <Link className="btn small" to="/encounters" onClick={() => session.setCampaignId(c.id)}>Encounters</Link>}
          {admin && rename === undefined && <button className="btn small" onClick={() => setRename(c.name)}>Rename</button>}
        </div>
      </div>
      <p className="faint" style={{ margin: "-12px 0 0" }}>
        {started(c) && `Started ${started(c)} · `}{inIt.length} member{inIt.length === 1 ? "" : "s"} · {rows.length} character{rows.length === 1 ? "" : "s"}
        {gms.length ? ` · GM: ${gms.map((g) => nameOf(g.user_id)).join(", ")}` : " · No GM yet (admins run it)"}
      </p>
      {msg && <div className="inset" role="status">{msg}</div>}

      <NotesBox title="Description" hint="What this campaign is about: its setting, style and house rules. Everyone in the campaign reads it." empty={gm ? "No description yet. Add one for your players." : "The GM hasn’t written a description yet."}
        text={c.description || ""} canEdit={gm} onSave={(t) => run("save the description", () => db.rpc("set_campaign_notes", { cid: c.id, p_description: t, p_public_notes: null }))} />
      <NotesBox title="GM notes (public)" hint="Notes from the GM that everyone in the campaign can read: session recaps, reminders, what’s next." empty="No notes yet."
        text={c.public_notes || ""} canEdit={gm} onSave={(t) => run("save the notes", () => db.rpc("set_campaign_notes", { cid: c.id, p_description: null, p_public_notes: t }))} />
      {gm && <PrivateNotes campaignId={c.id} setMsg={setMsg} />}

      <CampaignMaps campaignId={c.id} gm={gm} />

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>Members</h2>
        <p className="faint" style={{ margin: 0 }}>Everyone in this campaign. {admin ? "Make a member its GM to let them run its encounters and loot." : gm ? "As its GM you can add other members of this instance as players, and take players out." : "They see your characters in this campaign, and you see theirs."}</p>
        <div className="memgrid">
          {inIt.map((m) => {
            const theirs = charsOf(m.user_id);
            const canRemove = admin || (gm && m.role === "player" && m.user_id !== session.user?.id);
            return (
              <div key={m.user_id} className="memcard">
                <span className="campface big" aria-hidden="true">{initials(session.nameOf(m.user_id))}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div><b>{nameOf(m.user_id)}</b></div>
                  {admin ? (
                    <select value={m.role} aria-label={`Role of ${session.nameOf(m.user_id)}`} title="The GM runs the campaign’s encounters and loot and can edit its characters."
                      onChange={(e) => run("change the role", () => db.from("campaign_members").update({ role: e.target.value }).eq("campaign_id", c.id).eq("user_id", m.user_id))}>
                      <option value="player">Player</option>
                      <option value="gm">GM</option>
                    </select>
                  ) : <div className={m.role === "gm" ? "tag ok" : "faint"} style={{ display: "inline-block" }}>{m.role === "gm" ? "GM" : "Player"}</div>}
                  <div className="faint" style={{ fontSize: 13 }}>{theirs.length ? theirs.map((r) => r.c.name || "Unnamed").join(", ") : m.role === "gm" ? "" : "No character in this campaign yet"}</div>
                </div>
                {canRemove && <button className="btn small" onClick={() => {
                  if (confirm(`Take ${session.nameOf(m.user_id) || "this member"} out of ${c.name}? They stop seeing its players, characters and rolls. Their characters stay in the campaign.`)) run("remove the member", () => db.from("campaign_members").delete().eq("campaign_id", c.id).eq("user_id", m.user_id));
                }}>Remove</button>}
              </div>
            );
          })}
        </div>
        {(admin || gm) && others.length > 0 && (
          <form style={{ display: "flex", gap: 6, flexWrap: "wrap" }} onSubmit={(e) => { e.preventDefault(); if (add) { const u = add; setAdd(""); run("add the member", () => db.from("campaign_members").insert({ campaign_id: c.id, user_id: u })); } }}>
            <select value={add} onChange={(e) => setAdd(e.target.value)} aria-label={`Add a member to ${c.name}`}>
              <option value="">{admin ? "Add a member of this instance…" : "Add a player from this instance…"}</option>
              {others.map((m) => <option key={m.user_id} value={m.user_id}>{nameOf(m.user_id)}</option>)}
            </select>
            <button className="btn small" disabled={!add}>Add</button>
            {admin && <Link className="btn small" to="/settings">Invite someone new</Link>}
          </form>
        )}
      </section>

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>Active characters</h2>
        <p className="faint" style={{ margin: 0 }}>These characters are in this campaign{gm ? "; hidden ones show to you as its GM" : ", except any their players have hidden"}.</p>
        {rows.length === 0 ? <p className="muted" style={{ margin: 0 }}>No characters in this campaign yet. A player can move one in from the Characters page.</p> : (
          <div className="memgrid">
            {rows.map((r) => <CharBox key={r.c.id} row={r} campaignName={c.name} gm={gm} nameOf={nameOf} />)}
          </div>
        )}
      </section>
    </div>
  );
}

/** A Markdown box on the campaign page: read by everyone it's for, written by the campaign's GM. */
function NotesBox({ title, hint, empty, text, canEdit, onSave, privateNote }: {
  title: string; hint: string; empty: string; text: string; canEdit: boolean; onSave: (t: string) => Promise<boolean>; privateNote?: boolean;
}) {
  const [draft, setDraft] = useState<string>();
  const [saving, setSaving] = useState(false);
  // a box with nothing in it isn't shown to those who can't write in it
  if (!canEdit && !text.trim()) return null;
  return (
    <section className={`panel stack ${privateNote ? "privnote" : ""}`}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        {canEdit && draft === undefined && <button className="btn small" onClick={() => setDraft(text)}>{text.trim() ? "Edit" : "Write"}</button>}
      </div>
      <p className="faint" style={{ margin: 0 }}>{hint}</p>
      {draft !== undefined ? (
        <form className="stack" style={{ gap: 8 }} onSubmit={async (e) => { e.preventDefault(); setSaving(true); const ok = await onSave(draft); setSaving(false); if (ok) setDraft(undefined); }}>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={Math.min(24, Math.max(6, draft.split("\n").length + 2))} aria-label={title} placeholder="Markdown works: **bold**, *italics*, lists with -, headings with #." />
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn small primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            <button type="button" className="btn small" onClick={() => setDraft(undefined)}>Cancel</button>
          </div>
        </form>
      ) : text.trim() ? <Md md={text} className="campnotes" /> : <p className="muted" style={{ margin: 0 }}>{empty}</p>}
    </section>
  );
}

/** The GM's private notes: only the campaign's GM (and admins) can read or write them. */
function PrivateNotes({ campaignId, setMsg }: { campaignId: string; setMsg: (m: string) => void }) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.from("campaign_private_notes").select("notes").eq("campaign_id", campaignId).maybeSingle().then(({ data }) => { if (alive) setText((data?.notes as string) || ""); });
    return () => { alive = false; };
  }, [campaignId]);
  return (
    <NotesBox title="GM notes (private)" hint="Only you (the GM) and admins can read these: secrets, plans, who knows what." empty="No private notes yet."
      text={text} canEdit privateNote
      onSave={async (t) => {
        const { error } = await supabase!.from("campaign_private_notes").upsert({ campaign_id: campaignId, notes: t, updated_at: new Date().toISOString() });
        if (error) { setMsg(`Couldn’t save the private notes: ${error.message}`); return false; }
        setMsg("");
        setText(t);
        return true;
      }} />
  );
}

/** A character in the campaign, over the image behind its sheet (darkened so the text reads). */
function CharBox({ row, campaignName, gm, nameOf }: { row: CharRow; campaignName: string; gm: boolean; nameOf: (uid: string) => string }) {
  const session = useSession();
  const chars = useCharacters();
  const { byId } = useContent();
  const { c: ch, owner, hidden } = row;
  const backdrop = useCharacterBackdrop(ch, session.settings.hidden_backgrounds || []);
  const infos = classInfos(ch, byId);
  const level = infos.reduce((n, i) => n + (i.level || 0), 0);
  return (
    <div className={`memcard charbox ${hidden ? "charhidden" : ""} ${backdrop ? "hasbg" : ""}`} style={backdrop ? { backgroundImage: `url("${backdrop}")` } : undefined}>
      <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 18, fontWeight: 600 }}>{ch.name || "Unnamed character"} {hidden && <span className="tag warn">Hidden</span>}</div>
        <div className="cbsub">{[level ? `Level ${level}` : "", byId(ch.speciesId)?.name, classLabel(infos, true)].filter(Boolean).join(" · ") || "Not started"}</div>
        <div className="cbsub">Player: {owner ? nameOf(owner) : "—"}</div>
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          <Link className="btn small primary" to={`/sheet/${ch.id}`}>View</Link>
          {chars.canEdit(ch.id) && <Link className="btn small" to={`/build/${ch.id}`}>Edit</Link>}
          {gm && owner !== session.user?.id && (
            <button className="btn small" title="Take this character out of the campaign. It stays with its player, in no campaign."
              onClick={() => confirm(`Take ${ch.name || "this character"} out of ${campaignName}? It stays with its player.`) && (session.isAdmin ? chars.setCampaign(ch.id, null) : chars.removeFromCampaign(ch.id))}>Remove</button>
          )}
        </div>
      </div>
    </div>
  );
}

