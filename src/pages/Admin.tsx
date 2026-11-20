import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/backend.ts";
import { useSession, type Member } from "../lib/session.tsx";
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
}

export default function Admin() {
  const session = useSession();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState<string>();
  const [msg, setMsg] = useState("");
  const [myName, setMyName] = useState(session.me?.display_name || "");

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
    const { error } = await supabase.from("invites").insert({ note, created_by: session.user.id });
    if (error) return setMsg(error.message);
    setNote("");
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
              <button className="btn primary small" onClick={create}>Create invite link</button>
            </div>
            {invites.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table className="data">
                  <thead><tr><th>For</th><th>Status</th><th>Link</th><th></th></tr></thead>
                  <tbody>
                    {invites.map((i) => {
                      const open = status(i) === "Open";
                      return (
                        <tr key={i.id}>
                          <td>{i.note || "—"}</td>
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
