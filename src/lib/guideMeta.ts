/**
 * The Format guide's version and publish date live at the top of
 * docs/CONTENT_FORMAT.md, under its title:
 *
 *   # Content Format Guide
 *   **Version:** 0.5 (draft)
 *   **Published:** 2026-11-20
 *
 * Update both whenever the guide changes.
 */
export interface GuideMeta {
  version?: string;
  published?: Date;
  body: string; // the guide without its title and these lines
}

export function guideMeta(md: string): GuideMeta {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  let i = /^# /.test(lines[0] || "") ? 1 : 0;
  let version: string | undefined;
  let published: Date | undefined;
  for (; i < lines.length; i++) {
    const m = lines[i].match(/^\*\*(Version|Published):\*\*\s*(.+?)\s*$/i);
    if (!m) break;
    if (/version/i.test(m[1])) version = m[2];
    else {
      const d = m[2].match(/^(\d{4})-(\d{2})-(\d{2})$/);
      // a calendar date, read in local time so it never shifts a day
      if (d) published = new Date(+d[1], +d[2] - 1, +d[3]);
    }
  }
  return { version, published, body: lines.slice(i).join("\n").replace(/^\s+/, "") };
}
