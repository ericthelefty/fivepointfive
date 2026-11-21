import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A row of tabs or steps. On phones it becomes one line you can swipe, with ‹ › buttons and a fade
 * on whichever side has more (like the original app). On wide screens it wraps as before.
 */
export function ScrollRow({ className, label, children, more = "More", active }: {
  className: string; label: string; children: React.ReactNode; more?: string;
  /** the selected tab or step; when it changes it is scrolled into view */
  active?: string | number;
}) {
  const ref = useRef<HTMLElement>(null);
  const [edge, setEdge] = useState({ l: false, r: false });
  const update = useCallback(() => {
    const t = ref.current;
    if (!t) return;
    const l = t.scrollLeft > 4;
    const r = t.scrollWidth - t.clientWidth - t.scrollLeft > 4;
    setEdge((e) => (e.l === l && e.r === r ? e : { l, r }));
  }, []);
  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update]);
  useEffect(() => { update(); });
  // keep the selected item in view when it changes
  useEffect(() => {
    const t = ref.current;
    const on = t?.querySelector<HTMLElement>(".on");
    if (t && on && t.scrollWidth > t.clientWidth) {
      const left = on.offsetLeft - t.offsetLeft;
      if (left < t.scrollLeft || left + on.offsetWidth > t.scrollLeft + t.clientWidth) t.scrollTo({ left: Math.max(0, left - 24) });
    }
  }, [active]);
  const go = (d: number) => {
    const t = ref.current;
    if (t) t.scrollBy({ left: d * t.clientWidth * 0.7, behavior: "smooth" });
  };
  return (
    <div className={`tabsw ${edge.l ? "more-l" : ""} ${edge.r ? "more-r" : ""}`}>
      <nav ref={ref} className={className} aria-label={label} onScroll={update}>{children}</nav>
      <button type="button" className="tabmore r" aria-label={`${more} (scroll right)`} title={more} onClick={() => go(1)}>›</button>
      <button type="button" className="tabmore l" aria-label="Scroll back" title="Back" onClick={() => go(-1)}>‹</button>
    </div>
  );
}
