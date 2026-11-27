/**
 * The map's tool icons: simple line drawings in the button's text colour, so they all match, and all change together
 * when a tool is turned on (light on dark, dark on gold).
 */
import type { ReactNode } from "react";

const paths: Record<string, ReactNode> = {
  select: <path d="M6 3.5l12 7.2-5.3 1.4 3.4 6.1-2.3 1.3-3.4-6.1L6.5 17z" fill="currentColor" stroke="none" />,
  move: <><path d="M12 3v18M3 12h18" /><path d="M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5" /></>,
  reveal: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" /></>,
  cover: <path d="M7 18.5h10.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6-1.3A4.7 4.7 0 0 0 7 18.5z" />,
  fog: <><path d="M7 14.5h10.5a3.6 3.6 0 0 0 .4-7.2 5 5 0 0 0-9.6-1.2A4.2 4.2 0 0 0 7 14.5z" /><path d="M4 18h9M15.5 18H20M6 21h12" /></>,
  measure: <><path d="M3.5 16.5l13-13 4 4-13 13z" /><path d="M7 13l1.8 1.8M9.8 10.2l1.2 1.2M12.6 7.4l1.8 1.8M15.4 4.6l1.2 1.2" /></>,
  ping: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" /></>,
  undo: <><path d="M8.5 6.5L4 11l4.5 4.5" /><path d="M4.5 11H14a5.5 5.5 0 0 1 0 11h-3" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  fit: <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />,
};

export function MapIcon({ name }: { name: keyof typeof paths | string }) {
  return (
    <svg className="micon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
