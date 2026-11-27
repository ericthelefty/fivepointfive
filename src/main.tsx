import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, NavLink, Link, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import "./styles.css";
import { ContentProvider, useContent } from "./lib/store.tsx";
import { SessionProvider, useSession } from "./lib/session.tsx";
import { CharactersProvider, useCharacters } from "./lib/characters.tsx";
import { EncountersProvider, useEncounters } from "./lib/encounters.tsx";
import { cloud, configError, demo, DEMO_KEY } from "./lib/backend.ts";
import { SAMPLES, makeSample } from "./lib/samples.ts";
import { Join, ResetPassword, RESET_PATH, SignIn } from "./pages/Auth.tsx";
import Admin from "./pages/Admin.tsx";
import Campaigns, { CampaignPage } from "./pages/Campaigns.tsx";
import Home from "./pages/Home.tsx";
import Builder from "./pages/Builder.tsx";
import Sheet from "./pages/Sheet.tsx";
import LootPage, { LootPopup } from "./pages/Loot.tsx";
import Library from "./pages/Library.tsx";
import Content from "./pages/Content.tsx";
import Guide from "./pages/Guide.tsx";
import { EncounterList, EncounterView } from "./pages/Encounters.tsx";
import { PlayerMap } from "./pages/EncounterMap.tsx";

export const ATTRIBUTION =
  "This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.";

/** /demo: open the sample character's sheet, adding it the first time (in this browser only). */
function DemoStart() {
  const chars = useCharacters();
  const nav = useNavigate();
  const started = useRef(false);
  useEffect(() => {
    if (!demo) { nav("/", { replace: true }); return; }
    if (started.current || !chars.ready) return;
    started.current = true;
    const have = chars.rows[0]?.c;
    if (have) { nav(`/sheet/${have.id}`, { replace: true }); return; }
    const c = makeSample(SAMPLES.find((x) => x.label.startsWith("Vessa")) || SAMPLES[0]);
    chars.create(c).then(() => nav(`/sheet/${c.id}`, { replace: true }));
  }, [chars, nav]);
  return <div className="muted">Opening the demo character…</div>;
}

function DemoBanner() {
  return (
    <div className="demobar" role="status">
      <span><b>Demo:</b> no sign-in needed. Anything you make is saved only in this browser.</span>
      <button className="btn small" onClick={() => { try { sessionStorage.removeItem(DEMO_KEY); } catch { /* private mode */ } location.href = "/"; }}>Exit demo</button>
    </div>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const location = useLocation();
  if (cloud && location.pathname === RESET_PATH) return <ResetPassword />;
  if (session.status === "loading") return <div className="muted">Connecting…</div>;
  if (session.status === "signedOut") return <SignIn />;
  if (session.status === "empty" || session.status === "needsInvite") return <Join />;
  return <>{children}</>;
}

/** Dark (default) or light parchment theme, kept in this browser. */
const THEME_KEY = "fpf.theme";
function initialTheme(): "dark" | "light" {
  try { return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark"; } catch { return "dark"; }
}
document.documentElement.dataset.theme = initialTheme();

function Shell() {
  const { ready, error } = useContent();
  const session = useSession();
  const encounters = useEncounters();
  const [menu, setMenu] = useState(false);
  // the group's name (Settings), unless it's still the old default
  const groupName = cloud && session.status === "ready" && session.settings.instance_name !== "fivepointfive" ? session.settings.instance_name.trim() : "";
  useEffect(() => {
    const base = "fivepointfive · 5.5E compatible character builder and play sheet";
    document.title = groupName ? `${groupName} · fivepointfive` : base;
  }, [groupName]);
  const [theme, setTheme] = useState(initialTheme);
  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch { /* private mode */ }
  };
  return (
    <div className="app">
      <header className={`topbar ${menu ? "menuopen" : ""}`}>
        <Link to="/" className="brand">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#e3b45a" strokeWidth="1.6" aria-hidden="true">
            <path d="M12 2l8.5 5v10L12 22l-8.5-5V7z" />
            <path d="M12 2v20M3.5 7l17 10M20.5 7l-17 10" />
          </svg>
          <b>fivepointfive</b>
          <span className="badge">5.5E compatible</span>
          {groupName && <span className="instname">{groupName}</span>}
        </Link>
        <button className="btn small menubtn" aria-expanded={menu} aria-controls="topnav" aria-label={menu ? "Close menu" : "Menu"} onClick={() => setMenu(!menu)}>
          {menu ? <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1 }}>−</span> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>}
        </button>
        <nav className="topnav" id="topnav" aria-label="Main" onClick={(e) => { if ((e.target as HTMLElement).closest("a,button")) setMenu(false); }}>
          <NavLink to="/" end>Characters</NavLink>
          {cloud && session.status === "ready" && <NavLink to="/campaigns">Campaigns</NavLink>}
          {encounters.allowed && <NavLink to="/encounters">Encounters</NavLink>}
          <NavLink to="/library">Library</NavLink>
          <NavLink to="/content">Content packs</NavLink>
          <NavLink to="/guide">Format guide</NavLink>
          {cloud && session.status === "ready" && <NavLink to="/settings">{session.isAdmin ? "Settings" : "Account"}</NavLink>}
          <button className="themebtn" style={{ alignSelf: "center" }} aria-label={theme === "dark" ? "Use the light theme" : "Use the dark theme"} onClick={flip}>{theme === "dark" ? "☀ Light" : "☾ Dark"}</button>
          {cloud && session.user && <button className="btn small" style={{ alignSelf: "center" }} onClick={session.signOut}>Sign out</button>}
        </nav>
      </header>
      {demo && <DemoBanner />}
      <main className="page">
        {error ? (
          <div className="panel">Couldn’t load game content: {error}</div>
        ) : !ready ? (
          <div className="muted">Loading content…</div>
        ) : (
          <Gate>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/demo" element={<DemoStart />} />
            <Route path="/build/:id" element={<Builder />} />
            <Route path="/sheet/:id" element={<Sheet />} />
            <Route path="/loot/:id" element={<LootPage />} />
            <Route path="/campaigns" element={cloud ? <Campaigns /> : <div className="panel">Campaigns divide the players of a shared instance. This copy runs in local-only mode, so there’s just you.</div>} />
            <Route path="/campaigns/:id" element={cloud ? <CampaignPage /> : <div className="panel">Campaigns need a shared instance.</div>} />
            <Route path="/map/:id" element={cloud ? <PlayerMap /> : <div className="panel">Maps need a shared instance.</div>} />
            <Route path="/encounters" element={<EncounterList />} />
            <Route path="/encounters/:id" element={<EncounterView />} />
            <Route path="/library" element={<Library />} />
            <Route path="/content" element={<Content />} />
            <Route path="/guide" element={<Guide />} />
            <Route path="/settings" element={cloud ? <Admin /> : <div className="panel">This copy of fivepointfive runs in local-only mode: everything is saved in this browser. See the README to set up a shared instance.</div>} />
            <Route path="*" element={<div className="panel">Page not found. <Link to="/">Go home</Link></div>} />
          </Routes>
          {cloud && <LootPopup />}
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
            <EncountersProvider>
              <Shell />
            </EncountersProvider>
          </CharactersProvider>
        </ContentProvider>
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
);
