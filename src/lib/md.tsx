import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({ gfm: true, breaks: false });

/** Render Markdown to sanitized HTML. User content is untrusted. */
export function renderMd(md: string): string {
  return DOMPurify.sanitize(marked.parse(md || "", { async: false }) as string);
}

export function Md({ md, className }: { md: string; className?: string }) {
  return <div className={`md ${className || ""}`} dangerouslySetInnerHTML={{ __html: renderMd(md) }} />;
}

export function MdInline({ md }: { md: string }) {
  return <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parseInline(md || "", { async: false }) as string) }} />;
}
