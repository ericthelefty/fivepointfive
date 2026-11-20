import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, NavLink, Link, Route, Routes } from "react-router-dom";
import "./styles.css";
import { ContentProvider, useContent } from "./lib/store.tsx";
import { SessionProvider, useSession } from "./lib/session.tsx";
import { CharactersProvider } from "./lib/characters.tsx";
import { cloud, configError } from "./lib/backend.ts";
import { Join, SignIn } from "./pages/Auth.tsx";
import Admin from "./pages/Admin.tsx";
import Home from "./pages/Home.tsx";
import Builder from "./pages/Builder.tsx";
import Sheet from "./pages/Sheet.tsx";
import Library from "./pages/Library.tsx";
import Content from "./pages/Content.tsx";
import Guide from "./pages/Guide.tsx";

export const ATTRIBUTION =
  "This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.";

function Gate({ children }: { children: React.ReactNode }) {
  const session = useSession();
  if (session.status === "loading") return <div className="muted">Connecting…</div>;
  if (session.status === "signedOut") return <SignIn />;
  if (session.status === "empty" || session.status === "needsInvite") return <Join />;
  return <>{children}</>;
}

function Shell() {
  const { ready, error } = useContent();
  const session = useSession();
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#e3b45a" strokeWidth="1.6" aria-hidden="true">
            <path d="M12 2l8.5 5v10L12 22l-8.5-5V7z" />
            <path d="M12 2v20M3.5 7l17 10M20.5 7l-17 10" />
          </svg>
          <b>fivepointfive</b>
          <span className="badge">5E compatible</span>
        </Link>
        <nav className="topnav" aria-label="Main">
          <NavLink to="/" end>Characters</NavLink>
          <NavLink to="/library">Library</NavLink>
          <NavLink to="/content">Content packs</NavLink>
          <NavLink to="/guide">Format guide</NavLink>
          {cloud && session.status === "ready" && <NavLink to="/settings">{session.isAdmin ? "Settings" : "Account"}</NavLink>}
          {cloud && session.user && <button className="btn small" style={{ alignSelf: "center" }} onClick={session.signOut}>Sign out</button>}
        </nav>
      </header>
      <main className="page">
        {error ? (
          <div className="panel">Couldn’t load game content: {error}</div>
        ) : !ready ? (
          <div className="muted">Loading content…</div>
        ) : (
          <Gate>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/build/:id" element={<Builder />} />
            <Route path="/sheet/:id" element={<Sheet />} />
            <Route path="/library" element={<Library />} />
            <Route path="/content" element={<Content />} />
            <Route path="/guide" element={<Guide />} />
            <Route path="/settings" element={cloud ? <Admin /> : <div className="panel">This copy of fivepointfive runs in local-only mode: everything is saved in this browser. See the README to set up a shared instance.</div>} />
            <Route path="*" element={<div className="panel">Page not found. <Link to="/">Go home</Link></div>} />
          </Routes>
          </Gate>
        )}
      </main>
      <footer className="attrib">
        {ATTRIBUTION} fivepointfive is an independent, open-source project, not affiliated with Wizards of the Coast.{" "}
        <a href="https://github.com/ericthelefty/fivepointfive">Source on GitHub</a>.
      </footer>
    </div>
  );
}

function ConfigProblem({ message }: { message: string }) {
  return (
    <div className="app">
      <div className="panel" style={{ maxWidth: 560, margin: "48px auto" }}>
        <h2 style={{ marginTop: 0 }}>This instance isn't set up correctly</h2>
        <p>{message}</p>
        <p className="muted">
          Fix the environment variable where the app is hosted (on Vercel: Settings → Environment Variables), then redeploy. See docs/SELF_HOSTING.md. To run without an instance, remove both variables.
        </p>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  configError ? <ConfigProblem message={configError} /> :
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <ContentProvider>
          <CharactersProvider>
            <Shell />
          </CharactersProvider>
        </ContentProvider>
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
);
