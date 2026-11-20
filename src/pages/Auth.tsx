import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/backend.ts";
import { useSession } from "../lib/session.tsx";

const INVITE_KEY = "fpf.inviteToken";
export const RESET_PATH = "/reset-password";

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
  const [mode, setMode] = useState<"in" | "up" | "reset">(token ? "up" : "in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMsg("");
    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + RESET_PATH });
      setBusy(false);
      setMsg(error ? friendlyError(error.message) : "If there’s an account for that email, a reset link is on its way. Check your inbox (and spam), then follow the link.");
      return;
    }
    const res =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + (token ? `/?invite=${token}` : "/") } });
    setBusy(false);
    if (res.error) {
      setMsg(friendlyError(res.error.message));
      return;
    }
    if (mode === "up" && !res.data.session) setMsg("Check your email to confirm your account, then come back and sign in.");
  };

  return (
    <div className="panel" style={{ maxWidth: 440, margin: "40px auto" }}>
      <h1 style={{ marginBottom: 6 }}>{mode === "reset" ? "Reset your password" : token ? "You’re invited" : "Sign in"}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {mode === "reset"
          ? "Enter the email you signed up with and we’ll send you a link to choose a new password."
          : token
            ? "Create an account (or sign in) to join this group’s characters and content."
            : "This fivepointfive instance is private to its members."}
      </p>
      {mode !== "reset" && (
        <div role="group" aria-label="Sign in or create account" style={{ display: "flex", gap: 6, margin: "12px 0" }}>
          <button className="pill" aria-pressed={mode === "in"} onClick={() => { setMode("in"); setMsg(""); }}>Sign in</button>
          <button className="pill" aria-pressed={mode === "up"} onClick={() => { setMode("up"); setMsg(""); }}>Create account</button>
        </div>
      )}
      <form className="stack" onSubmit={submit}>
        <label className="field">Email<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        {mode !== "reset" && (
          <label className="field">Password<input type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} minLength={mode === "up" ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        )}
        <button className="btn primary" disabled={busy}>{busy ? "…" : mode === "in" ? "Sign in" : mode === "up" ? "Create account" : "Send reset link"}</button>
        {msg && <div className="inset" role="status">{msg}</div>}
      </form>
      {mode === "in" && (
        <button className="linkish" style={{ marginTop: 12 }} onClick={() => { setMode("reset"); setMsg(""); }}>Forgot your password?</button>
      )}
      {mode === "reset" && (
        <button className="linkish" style={{ marginTop: 12 }} onClick={() => { setMode("in"); setMsg(""); }}>Back to sign in</button>
      )}
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

function friendlyError(m: string): string {
  if (/not authorized/i.test(m)) return "This instance can’t send emails yet. Ask the admin to set up an email service in Supabase (see docs/SELF_HOSTING.md).";
  if (/rate limit|too many|security purposes/i.test(m)) return "Too many emails were sent just now. Wait a minute and try again.";
  if (/invalid login credentials/i.test(m)) return "That email and password don’t match. If you’ve forgotten your password, use “Forgot your password?” below.";
  if (/email not confirmed/i.test(m)) return "Confirm your email first: follow the link in the email we sent when you signed up.";
  return m;
}

/** Choose a new password. Used on the reset page and in account settings. */
export function NewPasswordForm({ onDone, submitLabel = "Save new password" }: { onDone?: () => void; submitLabel?: string }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (pw.length < 8) return setMsg("Use at least 8 characters.");
    if (pw !== pw2) return setMsg("The two passwords don’t match.");
    setBusy(true);
    setMsg("");
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      setMsg(
        /different from the old/i.test(error.message)
          ? "That’s your current password. Choose a different one."
          : /session|jwt|expired/i.test(error.message)
            ? "Your reset link has expired. Request a new one from the sign-in page."
            : error.message,
      );
      return;
    }
    setPw("");
    setPw2("");
    setMsg("Password changed.");
    onDone?.();
  };

  return (
    <form className="stack" onSubmit={submit}>
      <label className="field">New password<input type="password" autoComplete="new-password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} required /></label>
      <label className="field">Type it again<input type="password" autoComplete="new-password" minLength={8} value={pw2} onChange={(e) => setPw2(e.target.value)} required /></label>
      <button className="btn primary" disabled={busy}>{busy ? "…" : submitLabel}</button>
      {msg && <div className="inset" role="status">{msg}</div>}
    </form>
  );
}

/** Where the reset email's link lands. Supabase signs the person in from the link. */
export function ResetPassword() {
  const session = useSession();
  const navigate = useNavigate();
  const [linkError] = useState(() => {
    const h = new URLSearchParams(window.location.hash.slice(1));
    const q = new URLSearchParams(window.location.search);
    return h.get("error_description") || q.get("error_description");
  });

  if (session.status === "loading") return <div className="muted">Checking your reset link…</div>;

  if (!session.user) {
    return (
      <div className="panel" style={{ maxWidth: 440, margin: "40px auto" }}>
        <h1 style={{ marginBottom: 6 }}>Reset link didn’t work</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          {linkError && /expired|invalid/i.test(linkError)
            ? "This reset link has expired or was already used."
            : "This reset link isn’t valid any more."}{" "}
          Links work once and only for a short time. Request a new one and use the newest email.
        </p>
        <button className="btn primary" onClick={() => navigate("/", { replace: true })}>Go to sign in</button>
      </div>
    );
  }

  return (
    <div className="panel" style={{ maxWidth: 440, margin: "40px auto" }}>
      <h1 style={{ marginBottom: 6 }}>Choose a new password</h1>
      <p className="muted" style={{ marginTop: 0 }}>For {session.user.email}.</p>
      <NewPasswordForm onDone={() => setTimeout(() => navigate("/", { replace: true }), 900)} />
    </div>
  );
}
