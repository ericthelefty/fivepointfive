/** A character's token picture in a circle (or their initials), for cards and lists. */
import { useStoredImage } from "../lib/backgrounds.ts";

export function CharToken({ name, stored, className }: { name?: string; stored?: string; className?: string }) {
  const url = useStoredImage(stored);
  const initials = (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return <span className={`ctoken ${url ? "" : "none"} ${className || ""}`} aria-hidden="true">{url ? <img src={url} alt="" /> : initials}</span>;
}
