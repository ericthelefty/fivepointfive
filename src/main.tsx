import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, NavLink, Link, Route, Routes } from "react-router-dom";
import "./styles.css";
import { ContentProvider, useContent } from "./lib/store.tsx";
import Home from "./pages/Home.tsx";
import Builder from "./pages/Builder.tsx";
import Sheet from "./pages/Sheet.tsx";
import Library from "./pages/Library.tsx";
import Content from "./pages/Content.tsx";
import Guide from "./pages/Guide.tsx";

export const ATTRIBUTION =
  "This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.";

function Shell() {
  const { ready, error } = useContent();
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
        </nav>
      </header>
      <main className="page">
        {error ? (
          <div className="panel">Couldn’t load game content: {error}</div>
        ) : !ready ? (
          <div className="muted">Loading content…</div>
        ) : (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/build/:id" element={<Builder />} />
            <Route path="/sheet/:id" element={<Sheet />} />
            <Route path="/library" element={<Library />} />
            <Route path="/content" element={<Content />} />
            <Route path="/guide" element={<Guide />} />
            <Route path="*" element={<div className="panel">Page not found. <Link to="/">Go home</Link></div>} />
          </Routes>
        )}
      </main>
      <footer className="attrib">
        {ATTRIBUTION} fivepointfive is an independent, open-source project, not affiliated with Wizards of the Coast.{" "}
        <a href="https://github.com/ericthelefty/fivepointfive">Source on GitHub</a>.
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ContentProvider>
        <Shell />
      </ContentProvider>
    </BrowserRouter>
  </StrictMode>,
);
