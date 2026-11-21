import { useEffect, useState } from "react";

/** The width at which the sheet switches to the phone and tablet layout (same as the original app). */
export const NARROW = "(max-width: 900px)";

/** True while the media query matches; follows resizes and rotation. */
export function useMedia(query: string = NARROW): boolean {
  const get = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;
  const [on, setOn] = useState(get);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const m = window.matchMedia(query);
    const fn = () => setOn(m.matches);
    fn();
    m.addEventListener("change", fn);
    return () => m.removeEventListener("change", fn);
  }, [query]);
  return on;
}
