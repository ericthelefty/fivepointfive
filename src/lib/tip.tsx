import { createContext, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

/**
 * One tooltip, opened the way each device expects:
 * - mouse: hover shows it (a click also shows it, so clicking never feels broken)
 * - touch: tap shows or hides it; press-and-hold shows it too (the phone's own text-selection menu is turned off here)
 * - keyboard: focus shows it; Escape closes
 * A tap or click anywhere else, scrolling or resizing closes it. It's placed against the viewport, so a table that
 * scrolls sideways on a phone can't clip it.
 */
/**
 * Keep a tooltip bubble wholly on screen: after it's placed, nudge it back inside the window (8px margin) if any
 * edge pokes out, and drop its pointer when it had to move, since the pointer would no longer line up.
 */
export function fitBubble(el: HTMLElement | null) {
  if (!el) return;
  el.style.translate = "";
  const r = el.getBoundingClientRect();
  if (!r.width) return;
  const vw = document.documentElement.clientWidth || window.innerWidth, vh = window.innerHeight, m = 8;
  const dx = r.left < m ? m - r.left : r.right > vw - m ? Math.max(m - r.left, vw - m - r.right) : 0;
  const dy = r.top < m ? m - r.top : r.bottom > vh - m ? Math.max(m - r.top, vh - m - r.bottom) : 0;
  if (dx || dy) el.style.translate = `${Math.round(dx)}px ${Math.round(dy)}px`;
  el.classList.toggle("shifted", !!(dx || dy));
}

function useTip() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<CSSProperties>();
  const ref = useRef<HTMLSpanElement>(null);
  const id = useRef(`tip-${Math.random().toString(36).slice(2, 9)}`).current;
  const pointer = useRef<string>("mouse");
  const hold = useRef<{ timer?: number; fired?: boolean; down?: boolean }>({});
  useEffect(() => {
    if (!open) return;
    const r = ref.current?.getBoundingClientRect();
    if (r) {
      // line the bubble up with the trigger's nearer edge, above it unless that's off the top of the screen
      const fromRight = r.left + r.width / 2 > window.innerWidth / 2;
      const x: CSSProperties = fromRight ? { right: Math.max(8, window.innerWidth - r.right) } : { left: Math.max(8, r.left) };
      setPos(r.top > 110 ? { position: "fixed", ...x, bottom: window.innerHeight - r.top + 8 } : { position: "fixed", ...x, top: r.bottom + 8 });
    }
    const away = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const close = () => setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);
  const bubble = (text: ReactNode) => {
    const cls = ["tipbox", open && pos ? "open" : "", pos?.top !== undefined ? "below" : "", pos?.left !== undefined ? "left" : ""].filter(Boolean).join(" ");
    return <span id={id} role="tooltip" className={cls} style={pos} ref={open && pos ? (el: HTMLSpanElement | null) => fitBubble(el) : undefined}>{text}</span>;
  };
  const release = () => {
    window.clearTimeout(hold.current.timer);
    window.setTimeout(() => { hold.current.down = false; }, 0);
  };
  const trigger = {
    ref,
    tabIndex: 0,
    "aria-describedby": id,
    "aria-expanded": open,
    onPointerEnter: (e: ReactPointerEvent) => { pointer.current = e.pointerType; if (e.pointerType === "mouse") setOpen(true); },
    onPointerLeave: (e: ReactPointerEvent) => { if (e.pointerType === "mouse") setOpen(false); },
    onPointerDown: (e: ReactPointerEvent) => {
      pointer.current = e.pointerType;
      hold.current.down = true; // the focus that follows a press isn't keyboard focus
      if (e.pointerType === "mouse") return;
      hold.current.fired = false;
      window.clearTimeout(hold.current.timer);
      hold.current.timer = window.setTimeout(() => { hold.current.fired = true; setOpen(true); }, 450);
    },
    onPointerUp: () => release(),
    onPointerCancel: () => release(),
    onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
    onClick: () => {
      hold.current.down = false;
      if (pointer.current === "mouse") { setOpen(true); return; }
      if (hold.current.fired) { hold.current.fired = false; return; } // the press-and-hold already opened it
      setOpen((o) => !o);
    },
    onKeyDown: (e: ReactKeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); } },
    onFocus: () => { if (!hold.current.down) setOpen(true); },
    onBlur: () => setOpen(false),
  };
  return { trigger, bubble };
}

/**
 * Whether tooltips show at all. The play sheet turns them off unless Explainer Mode is on, so the sheet stays
 * uncluttered; everywhere else they're on.
 */
export const TipsOn = createContext(true);

/** Text or a small label that explains itself when clicked or tapped. Don't wrap other buttons or inputs in it. */
export function Tip({ tip, children, className }: { tip?: ReactNode; children: ReactNode; className?: string }) {
  const on = useContext(TipsOn);
  const { trigger, bubble } = useTip();
  if (!tip || !on) return className ? <span className={className}>{children}</span> : <>{children}</>;
  return (
    <span {...trigger} className={`tip ${className || ""}`}>
      {children}
      {bubble(tip)}
    </span>
  );
}

/**
 * A button that, when greyed out, says why on click or tap. A disabled button gets no pointer events,
 * so the wrapper around it carries the tooltip.
 */
export function Btn({ why, disabled, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { why?: string }) {
  const on = useContext(TipsOn);
  const { trigger, bubble } = useTip();
  if (!disabled || !why || !on) return <button {...rest} disabled={disabled} />;
  return (
    <span {...trigger} className="why">
      <button {...rest} disabled tabIndex={-1} />
      {bubble(why)}
    </span>
  );
}
