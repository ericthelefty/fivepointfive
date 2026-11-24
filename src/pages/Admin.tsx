import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/backend.ts";
import { useSession, type Member } from "../lib/session.tsx";
import { useCharacters } from "../lib/characters.tsx";
import AdminBackgrounds from "./AdminBackgrounds.tsx";
import { NewPasswordForm } from "./Auth.tsx";

interface Invite {
  id: string;
  token: string;
  note: string;
  created_at: string;
  expires_at: string;
  used_by: string | null;
  used_at: string | null;
  revoked: boolean;
  /** A character the invite hands over when it's used (migration 0011). */
  character_id: string | null;
}

export default function Admin() {
  const session = useSession();
  const [invites, setInvites] = useState<Invite[]>([]);
  const chars = useCharacters();
  const [note, setNote] = useState("");
  const [inviteChar, setInviteChar] = useState("");
  const [copied, setCopied] = useState<string>();
  const [msg, setMsg] = useState("");
  const [myName, setMyName] = useState(session.me?.display_name || "");
  // "fivepointfive" was the old default, which means no name
  const savedInstName = session.settings.instance_name === "fivepointfive" ? "" : session.settings.instance_name || "";
  const [instName, setInstName] = useState(savedInstName);
  const [instSaved, setInstSaved] = useState(false);
  useEffect(() => setInstName(savedInstName), [savedInstName]);
  const saveInstName = async () => {
    await session.setSetting("instance_name", instName.trim());
    setInstSaved(true);
  };

  const load = useCallback(async () => {
    if (!supabase || !session.isAdmin) return;
    const { data } = await supabase.from("invites").select("*").order("created_at", { ascending: false });
    setInvites((data || []) as Invite[]);
  }, [session.isAdmin]);
  useEffect(() => {
    load();
  }, [load]);

  const link = (t: string) => `${window.location.origin}/?invite=${t}`;

  const create = async () => {
    if (!supabase || !session.user) return;
    const { error } = await supabase.from("invites").insert({ note, created_by: session.user.id, character_id: inviteChar || null });
    if (error) return setMsg(error.message);
    setNote("");
    setInviteChar("");
    load();
  };
  const revoke = async (id: string) => {
    await supabase?.from("invites").update({ revoked: true }).eq("id", id);
    load();
  };
  const removeMember = async (m: Member) => {
    if (!confirm(`Remove ${m.display_name || "this member"} from the instance? Their characters and packs stay.`)) return;
    const { error } = await supabase!.from("members").delete().eq("user_id", m.user_id);
    if (error) return setMsg(error.message);
    session.refresh();
  };
  const setRole = async (m: Member, role: Member["role"]) => {
    const { error } = await supabase!.from("members").update({ role }).eq("user_id", m.user_id);
    if (error) return setMsg(error.message);
    session.refresh();
  };
  const saveName = async () => {
    await supabase?.from("members").update({ display_name: myName }).eq("user_id", session.user!.id);
    session.refresh();
  };

  const isAdminId = (id?: string) => session.members.some((m) => m.user_id === id && m.role === "admin");
  const giveable = chars.rows.filter((r) => isAdminId(r.owner)).sort((a, b) => (a.c.name || "").localeCompare(b.c.name || ""));
  const charName = (id: string | null) => (id ? chars.get(id)?.c.name || "a deleted character" : "");
  const status = (i: Invite) =>
    i.revoked ? "Revoked" : i.used_by ? `Used by ${session.nameOf(i.used_by)}` : new Date(i.expires_at) < new Date() ? "Expired" : "Open";

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div>
        <h1>{session.isAdmin ? "Instance settings" : "Your account"}</h1>
        <p className="muted" style={{ margin: "6px 0 0" }}>Signed in as {session.user?.email} · {session.isAdmin ? "Admin" : "Member"}</p>
      </div>
      {msg && <div className="inset" role="status">{msg}</div>}

      <section className="panel stack">
        <h2>Your name</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="text" value={myName} onChange={(e) => setMyName(e.target.value)} aria-label="Your display name" />
          <button className="btn small" onClick={saveName}>Save</button>
        </div>
      </section>

      <section className="panel stack">
        <h2>Change password</h2>
        <div style={{ maxWidth: 360 }}>
          <NewPasswordForm submitLabel="Change password" />
        </div>
      </section>

      {session.isAdmin && (
        <>
          <section className="panel stack">
            <h2>Instance name</h2>
            <p className="muted" style={{ margin: 0 }}>Your group’s name, shown next to fivepointfive at the top of every page and in the browser tab. Leave it empty for none.</p>
            <form style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }} onSubmit={(e) => { e.preventDefault(); saveInstName(); }}>
              <input type="text" value={instName} maxLength={60} onChange={(e) => { setInstName(e.target.value); setInstSaved(false); }} placeholder="e.g. The Hungry Edge" aria-label="Instance name" />
              <button className="btn small" type="submit" disabled={instName.trim() === savedInstName}>Save</button>
              {instSaved && <span className="faint" role="status">Saved</span>}
            </form>
          </section>

          <section className="panel stack">
            <h2>Shared game log</h2>
            <p className="muted" style={{ margin: 0 }}>When on, every member’s rolls also appear in a live table log that everyone can watch from any character sheet.</p>
            <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={session.settings.shared_log} onChange={(e) => session.setSetting("shared_log", e.target.checked)} style={{ width: 20, height: 20, accentColor: "var(--accent)" }} />
              Shared game log is {session.settings.shared_log ? "on" : "off"}
            </label>
          </section>

          <section className="panel stack">
            <h2>Invites</h2>
            <p className="muted" style={{ margin: 0 }}>Each link works once and expires after 14 days. Send it however you like: text, Discord, email.</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Who it’s for (optional)" aria-label="Invite note" />
              <select value={inviteChar} onChange={(e) => setInviteChar(e.target.value)} aria-label="Character to give with the invite">
                <option value="">No character</option>
                {giveable.map((r) => <option key={r.c.id} value={r.c.id}>Give them {r.c.name || "Unnamed"}</option>)}
              </select>
              <button className="btn primary small" onClick={create}>Create invite link</button>
            </div>
            <p className="faint" style={{ margin: 0 }}>Pick a character to hand it over when they join: it becomes theirs and its sheet opens once their account is set up. Only characters an admin still owns can be given.</p>
            {invites.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table className="data">
                  <thead><tr><th>For</th><th>Character</th><th>Status</th><th>Link</th><th></th></tr></thead>
                  <tbody>
                    {invites.map((i) => {
                      const open = status(i) === "Open";
                      return (
                        <tr key={i.id}>
                          <td>{i.note || "—"}</td>
                          <td>{i.character_id ? charName(i.character_id) : "—"}</td>
                          <td>{status(i)}</td>
                          <td>{open ? <code style={{ wordBreak: "break-all" }}>{link(i.token)}</code> : "—"}</td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            {open && <button className="btn small" onClick={() => { navigator.clipboard?.writeText(link(i.token)); setCopied(i.id); }}>{copied === i.id ? "Copied" : "Copy"}</button>}{" "}
                            {open && <button className="btn small" onClick={() => revoke(i.id)}>Revoke</button>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <AdminBackgrounds />

          <section className="panel stack">
            <h2>Members</h2>
            <table className="data">
              <thead><tr><th>Name</th><th>Role</th><th>Joined</th><th></th></tr></thead>
              <tbody>
                {session.members.map((m) => (
                  <tr key={m.user_id}>
                    <td>{m.display_name || "—"}{m.user_id === session.user?.id ? " (you)" : ""}</td>
                    <td>{m.role === "admin" ? "Admin" : "Member"}</td>
                    <td>{m.created_at ? new Date(m.created_at).toLocaleDateString() : ""}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {m.user_id !== session.user?.id && (
                        <>
                          <button className="btn small" onClick={() => setRole(m, m.role === "admin" ? "member" : "admin")}>{m.role === "admin" ? "Make member" : "Make admin"}</button>{" "}
                          <button className="btn small" onClick={() => removeMember(m)}>Remove</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
