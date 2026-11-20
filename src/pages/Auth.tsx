import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/backend.ts";
import { useSession } from "../lib/session.tsx";

const INVITE_KEY = "fpf.inviteToken";

/** Remember an invite token from the URL so it survives sign-up. */
export function useInviteToken(): string | null {
  const [params] = useSearchParams();
  const t = params.get("invite");
  useEffect(() => {
    if (t) {
      try {
        sessionStorage.setItem(INVITE_KEY, t);
      } catch {
        /* ignore */
      }
    }
  }, [t]);
  try {
    return t || sessionStorage.getItem(INVITE_KEY);
  } catch {
    return t;
  }
}

function clearInvite() {
  try {
    sessionStorage.removeItem(INVITE_KEY);
  } catch {
    /* ignore */
  }
}

export function SignIn() {
  const token = useInviteToken();
  const [mode, setMode] = useState<"in" | "up">(token ? "up" : "in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMsg("");
    const res =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + (token ? `/?invite=${token}` : "/") } });
    setBusy(false);
    if (res.error) {
      setMsg(
        /not authorized/i.test(res.error.message)
          ? "This instance can’t send confirmation emails yet. Ask the admin to turn off “Confirm email” in Supabase or set up an email service."
          : res.error.message,
      );
      return;
    }
    if (mode === "up" && !res.data.session) setMsg("Check your email to confirm your account, then come back and sign in.");
  };

  return (
    <div className="panel" style={{ maxWidth: 440, margin: "40px auto" }}>
      <h1 style={{ marginBottom: 6 }}>{token ? "You’re invited" : "Sign in"}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {token ? "Create an account (or sign in) to join this group’s characters and content." : "This fivepointfive instance is private to its members."}
      </p>
      <div role="group" aria-label="Sign in or create account" style={{ display: "flex", gap: 6, margin: "12px 0" }}>
        <button className="pill" aria-pressed={mode === "in"} onClick={() => setMode("in")}>Sign in</button>
        <button className="pill" aria-pressed={mode === "up"} onClick={() => setMode("up")}>Create account</button>
      </div>
      <form className="stack" onSubmit={submit}>
        <label className="field">Email<input type="text" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label className="field">Password<input type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required style={{ background: "var(--bg)", border: "1px solid var(--line-3)", borderRadius: 8, padding: "9px 11px", minHeight: 40 }} /></label>
        <button className="btn primary" disabled={busy}>{busy ? "…" : mode === "in" ? "Sign in" : "Create account"}</button>
        {msg && <div className="inset" role="status">{msg}</div>}
      </form>
    </div>
  );
}

/** Signed in, but not a member yet: claim an empty instance or redeem an invite. */
export function Join() {
  const session = useSession();
  const token = useInviteToken();
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const go = async () => {
    if (!supabase) return;
    setBusy(true);
    setMsg("");
    const { data, error } =
      session.status === "empty"
        ? await supabase.rpc("claim_instance", { p_name: name })
        : await supabase.rpc("accept_invite", { p_token: token || "", p_name: name });
    setBusy(false);
    if (error) return setMsg(error.message);
    if (data === "invalid") return setMsg("That invite has expired, been used or been revoked. Ask the admin for a new one.");
    if (data === "none") return setMsg("Someone already set up this instance. You’ll need an invite from them.");
    clearInvite();
    await session.refresh();
  };

  const empty = session.status === "empty";
  return (
    <div className="panel" style={{ maxWidth: 480, margin: "40px auto" }}>
      <h1 style={{ marginBottom: 6 }}>{empty ? "Set up this instance" : token ? "Join the group" : "You need an invite"}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {empty
          ? "Nobody has set up this instance yet. If it’s yours, you’ll become its admin: you can invite people and manage everything."
          : token
            ? "One last step: choose the name other members will see."
            : `You’re signed in as ${session.user?.email}, but you’re not a member of this instance. Ask its admin for an invite link.`}
      </p>
      {(empty || token) && (
        <div className="stack">
          <label className="field">Your name (shown to other members)<input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Eric" /></label>
          <button className="btn primary" disabled={busy || !name.trim()} onClick={go}>{empty ? "Become the admin" : "Join"}</button>
        </div>
      )}
      {msg && <div className="inset" role="status" style={{ marginTop: 10 }}>{msg}</div>}
      <button className="btn small" style={{ marginTop: 14 }} onClick={session.signOut}>Sign out</button>
    </div>
  );
}
