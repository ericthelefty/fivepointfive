/**
 * Keeps the repository's own paperwork in step with the code, so it can't drift: the version is the same in
 * package.json, the README and the changelog; every database migration is in the self-hosting guide; the license
 * files are there. See CONTRIBUTING.md ("Releasing a version", "Changing the database").
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const pkg = JSON.parse(read("package.json")) as { version: string; license?: string };

describe("repository paperwork", () => {
  it("README, package.json, package-lock.json and CHANGELOG.md agree on the version", () => {
    const v = pkg.version;
    expect(read("README.md")).toMatch(new RegExp(`\\*\\*Status:\\*\\* v${v.replace(/\./g, "\\.")}\\b`));
    expect(JSON.parse(read("package-lock.json")).version).toBe(v);
    const changelog = read("CHANGELOG.md");
    expect(changelog).toMatch(/^## Unreleased$/m);
    // the newest released version in the changelog is the package version
    const released = [...changelog.matchAll(/^## (\d+\.\d+\.\d+) \(\d{4}-\d{2}-\d{2}\)$/gm)].map((m) => m[1]);
    expect(released[0]).toBe(v);
  });

  it("every migration is listed in docs/SELF_HOSTING.md, numbered in order", () => {
    const files = readdirSync(join(ROOT, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
    expect(files.length).toBeGreaterThan(0);
    const guide = read("docs/SELF_HOSTING.md");
    files.forEach((f, i) => {
      expect(f.startsWith(String(i + 1).padStart(4, "0") + "_"), `${f} should be numbered ${i + 1}`).toBe(true);
      expect(guide.includes(f), `${f} is missing from docs/SELF_HOSTING.md`).toBe(true);
    });
  });

  it("the code license and the SRD license are in place", () => {
    expect(pkg.license).toBe("MIT");
    expect(read("LICENSE")).toMatch(/^MIT License/);
    expect(existsSync(join(ROOT, "content/srd-5.2.1/LICENSE.md"))).toBe(true);
    expect(read("README.md")).toMatch(/\[MIT\]\(LICENSE\)/);
  });

  it("no copyrighted book packs are committed", () => {
    // only the SRD (CC-BY-4.0) lives in content/; the PHB, DMG, MM and other books are imported by players
    const packs = readdirSync(join(ROOT, "content"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    expect(packs).toEqual(["srd-5.2.1"]);
  });
});
