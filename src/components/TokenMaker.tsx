/**
 * Making a character's token: pick a picture, then drag it and zoom it so the face (or whatever you like) sits in the
 * circle. Saved as a TOKEN_PX square image; the map shows it in a circle.
 */
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { MAX_UPLOAD_BYTES, TOKEN_PX } from "../lib/backgrounds.ts";

const VIEW = 240; // the circle on screen, in pixels

export function TokenMaker({ name, current, onSave, onRemove, onClose }: {
  name: string;
  /** The picture it has now, to show before a new one is picked. */
  current?: string;
  onSave: (img: Blob) => Promise<void>;
  onRemove?: () => Promise<void>;
  onClose: () => void;
}) {
  const [src, setSrc] = useState<string>();
  const [img, setImg] = useState<HTMLImageElement>();
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pick = (f?: File) => {
    setErr("");
    if (!f) return;
    if (!f.type.startsWith("image/")) { setErr("That file isn’t an image."); return; }
    if (f.size > MAX_UPLOAD_BYTES) { setErr("That image is over 20 MB. Pick a smaller one."); return; }
    const u = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => { setSrc(u); setImg(im); setZoom(1); setOff({ x: 0, y: 0 }); };
    im.onerror = () => setErr("Couldn’t open that image.");
    im.src = u;
  };

  // the picture covers the circle at zoom 1; offsets are in screen pixels from centred
  const base = img ? VIEW / Math.min(img.naturalWidth, img.naturalHeight) : 1;
  const scale = base * zoom;
  const w = img ? img.naturalWidth * scale : 0, h = img ? img.naturalHeight * scale : 0;
  const clamp = (o: { x: number; y: number }, z = zoom) => {
    if (!img) return o;
    const s = base * z, mx = Math.max(0, (img.naturalWidth * s - VIEW) / 2), my = Math.max(0, (img.naturalHeight * s - VIEW) / 2);
    return { x: Math.max(-mx, Math.min(mx, o.x)), y: Math.max(-my, Math.min(my, o.y)) };
  };

  const down = (e: RPointerEvent) => { if (!img) return; (e.target as Element).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y }; };
  const move = (e: RPointerEvent) => { const d = drag.current; if (d) setOff(clamp({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y })); };
  const up = () => { drag.current = null; };

  const save = async () => {
    if (!img) return;
    setBusy(true); setErr("");
    try {
      const c = document.createElement("canvas");
      c.width = c.height = TOKEN_PX;
      const ctx = c.getContext("2d")!;
      const k = TOKEN_PX / VIEW;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, (VIEW / 2 - w / 2 + off.x) * k, (VIEW / 2 - h / 2 + off.y) * k, w * k, h * k);
      const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/webp", 0.9))
        ?? await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.9));
      if (!blob) throw new Error("Couldn’t make the picture.");
      await onSave(blob);
      onClose();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="tokmodal" role="dialog" aria-label={`Token picture for ${name}`} onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tokbox">
        <div className="tokhead"><b>Token picture</b><button className="tokx" aria-label="Close" onClick={onClose}>×</button></div>
        <p className="tokhint">{img ? "Drag the picture to place it in the circle, and zoom to fit. This is how it looks on battle maps." : `A picture for ${name || "this character"}’s token on battle maps. Pick an image, then frame it in the circle.`}</p>
        <div className="tokview" style={{ width: VIEW, height: VIEW }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          onWheel={(e) => { if (!img) return; const z = Math.max(1, Math.min(5, zoom * Math.exp(-e.deltaY * 0.0015))); setZoom(z); setOff((o) => clamp(o, z)); }}>
          {img ? <img src={src} alt="" draggable={false} style={{ width: w, height: h, transform: `translate(${VIEW / 2 - w / 2 + off.x}px, ${VIEW / 2 - h / 2 + off.y}px)` }} />
            : current ? <img src={current} alt="" draggable={false} style={{ width: VIEW, height: VIEW }} />
            : <span className="tokempty">No picture yet</span>}
          <span className="tokring" aria-hidden="true" />
        </div>
        {img && (
          <label className="tokzoom"><span>Zoom</span>
            <input type="range" min={1} max={5} step={0.01} value={zoom} onChange={(e) => { const z = Number(e.target.value); setZoom(z); setOff((o) => clamp(o, z)); }} />
          </label>
        )}
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        <div className="tokbtns">
          <button className="btn small" onClick={() => file.current?.click()} disabled={busy}>{img || current ? "Pick another picture" : "Pick a picture"}</button>
          {img && <button className="btn small primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>}
          {!img && current && onRemove && <button className="btn small" disabled={busy} onClick={async () => { setBusy(true); try { await onRemove(); onClose(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } }}>Remove it</button>}
        </div>
        {err && <p className="tokerr" role="alert">{err}</p>}
      </div>
    </div>
  );
}
