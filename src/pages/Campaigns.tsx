/**
 * Campaigns: a way to divide the players of an instance. Members see only the players, characters, shared rolls,
 * encounters and loot of their own campaigns. The admin creates campaigns, adds members and can make one of them the
 * campaign's GM, who then runs its encounters and loot, adds other members of the instance to it as players and takes
 * players out. Everyone else sees the campaigns they're in and who's in them.
 */
import { useState } from "react";
import { supabase } from "../lib/backend.ts";
import { useSession, type Campaign } from "../lib/session.tsx";
import { useCharacters } from "../lib/characters.tsx";

export default function Campaigns() {
  const session = useSession();
  const chars = useCharacters();
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const admin = session.isAdmin;
  const mineIds = new Set(session.campaignMembers.filter((m) => m.user_id === session.user?.id).map((m) => m.campaign_id));
  const list = admin ? session.campaigns : session.campaigns.filter((c) => mineIds.has(c.id));

  const run = async (what: string, f: () => PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await f();
    if (error) setMsg(`Couldn’t ${what}: ${error.message}`);
    else setMsg("");
    await session.refresh();
    await chars.reload();
  };

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
  };

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div>
        <h1>Campaigns</h1>
        <p className="muted" style={{ margin: "6px 0 0", maxWidth: 760 }}>
          {admin
            ? "Each campaign is its own group: its players see only each other, the characters in the campaign, its shared rolls, encounters and loot. Add members to a campaign and make one of them its GM to let them run its encounters and loot. You see every campaign."
            : session.gmAny
              ? "The campaigns you’re in. You see the players, characters, shared rolls, encounters and loot of these campaigns only. In a campaign you run as GM, you can add other members of this instance as players and take players out."
              : "The campaigns you’re in. You see the players, characters, shared rolls, encounters and loot of these campaigns only."}
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
      {list.length === 0 && <div className="panel muted">{admin ? "No campaigns yet." : "You’re not in a campaign yet. Ask the admin to add you to one."}</div>}
      {list.map((c) => <CampaignPanel key={c.id} c={c} run={run} />)}
    </div>
  );
}

function CampaignPanel({ c, run }: { c: Campaign; run: (what: string, f: () => PromiseLike<{ error: { message: string } | null }>) => Promise<void> }) {
  const session = useSession();
  const chars = useCharacters();
  const admin = session.isAdmin;
  const gm = session.isGm(c.id);
  const [rename, setRename] = useState<string>();
  const [add, setAdd] = useState("");
  const inIt = session.campaignMembers.filter((m) => m.campaign_id === c.id);
  const others = session.members.filter((m) => !inIt.some((x) => x.user_id === m.user_id));
  const count = chars.rows.filter((r) => r.campaignId === c.id).length;
  const db = supabase!;
  return (
    <section className="panel" style={{ padding: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
        {rename !== undefined ? (
          <form style={{ display: "flex", gap: 6, flex: 1 }} onSubmit={(e) => { e.preventDefault(); const n = rename.trim(); setRename(undefined); if (n && n !== c.name) run("rename the campaign", () => db.from("campaigns").update({ name: n }).eq("id", c.id)); }}>
            <input autoFocus value={rename} onChange={(e) => setRename(e.target.value)} aria-label="Campaign name" style={{ flex: 1 }} />
            <button className="btn small primary">Save</button>
            <button type="button" className="btn small" onClick={() => setRename(undefined)}>Cancel</button>
          </form>
        ) : (
          <h2 style={{ margin: 0 }}>{c.name || "Unnamed campaign"}{session.campaignId === c.id && <span className="tag ok" style={{ marginLeft: 8, verticalAlign: "middle" }}>Showing</span>}</h2>
        )}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {session.campaignId !== c.id && <button className="btn small" onClick={() => session.setCampaignId(c.id)} title="Show this campaign’s characters and encounters">Show this campaign</button>}
          {admin && rename === undefined && <button className="btn small" onClick={() => setRename(c.name)}>Rename</button>}
          {admin && <button className="btn small" onClick={() => {
            if (confirm(`Delete the campaign ${c.name || ""}? Its encounters, loot and shared rolls go with it. Its characters stay with their players, in no campaign.`)) run("delete the campaign", () => db.from("campaigns").delete().eq("id", c.id));
          }}>Delete</button>}
        </div>
      </div>
      <p className="faint" style={{ margin: "4px 0 12px" }}>{inIt.length} member{inIt.length === 1 ? "" : "s"} · {count} character{count === 1 ? "" : "s"} you can see</p>
      <table className="camptbl">
        <tbody>
          {inIt.map((m) => (
            <tr key={m.user_id}>
              <td>{m.user_id === session.user?.id ? "You" : session.nameOf(m.user_id)}</td>
              <td>
                {admin ? (
                  <select value={m.role} aria-label={`Role of ${session.nameOf(m.user_id)} in ${c.name}`} title="The GM runs the campaign’s encounters and loot and can edit its characters."
                    onChange={(e) => run("change the role", () => db.from("campaign_members").update({ role: e.target.value }).eq("campaign_id", c.id).eq("user_id", m.user_id))}>
                    <option value="player">Player</option>
                    <option value="gm">GM</option>
                  </select>
                ) : <span className={m.role === "gm" ? "tag ok" : "faint"}>{m.role === "gm" ? "GM" : "Player"}</span>}
              </td>
              {(admin || (gm && m.role === "player" && m.user_id !== session.user?.id)) ? (
                <td style={{ textAlign: "right" }}>
                  <button className="btn small" onClick={() => {
                    if (confirm(`Take ${session.nameOf(m.user_id) || "this member"} out of ${c.name}? They stop seeing its players, characters and rolls. Their characters stay in the campaign.`)) run("remove the member", () => db.from("campaign_members").delete().eq("campaign_id", c.id).eq("user_id", m.user_id));
                  }}>Remove</button>
                </td>
              ) : (admin || gm) ? <td /> : null}
            </tr>
          ))}
        </tbody>
      </table>
      {(admin || gm) && others.length > 0 && (
        <form style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }} onSubmit={(e) => { e.preventDefault(); if (add) { const u = add; setAdd(""); run("add the member", () => db.from("campaign_members").insert({ campaign_id: c.id, user_id: u })); } }}>
          <select value={add} onChange={(e) => setAdd(e.target.value)} aria-label={`Add a member to ${c.name}`}>
            <option value="">{admin ? "Add a member…" : "Add a player…"}</option>
            {others.map((m) => <option key={m.user_id} value={m.user_id}>{m.user_id === session.user?.id ? "You" : session.nameOf(m.user_id)}</option>)}
          </select>
          <button className="btn small" disabled={!add}>Add</button>
        </form>
      )}
    </section>
  );
}
