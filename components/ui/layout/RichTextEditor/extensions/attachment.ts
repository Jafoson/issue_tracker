import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { AttachmentView } from "../components/AttachmentView/AttachmentView";

/**
 * The attachment node in the editor. A single type instead of three — image,
 * video, and other files only differ in how they're rendered (`mimeType`),
 * not in the schema.
 *
 * An inline atom instead of a block — like a very wide chip. That way,
 * several small images flow side by side on one line instead of each being
 * forced onto its own line (`ATTACHMENT_IMAGE_DEFAULT_WIDTH` in
 * `lib/richtext/attachments.ts` keeps them compact for this reason). Video
 * and file still look block-like regardless — not via the schema but via CSS
 * (`display: block` in `attachmentView.module.scss`/`richText.module.scss`):
 * for those, sitting side by side would be impractical, but a second schema
 * just for that would be unnecessary.
 *
 * **Only** `id` (as `data-id`) and `width` (as `data-width`, set by the
 * resize handle in the editor) are persisted — `url`/`name`/`mimeType`/`size`
 * are pure runtime attributes, deliberately excluded from the HTML export via
 * `renderHTML: () => ({})`: a presigned URL expires after an hour, so
 * carrying it along through copy/paste would be pointless. On the next load,
 * `withResolvedAttachments` (`lib/richtext/attachments.ts`) resolves them
 * fresh from the `Attachment` row.
 */

export interface AttachmentOptions {
  /** Deletes the attachment row server-side. `null` ⇒ no remove button
   *  (read-only display). Uploading itself needs no option here — it runs
   *  in `RichTextEditor.tsx` BEFORE insertion, the node is already created
   *  with the resolved attributes. */
  onRemove: ((id: string) => Promise<void>) | null;
}

export const AttachmentNode = Node.create<AttachmentOptions>({
  name: "attachment",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return { onRemove: null };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-id"),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.id ? { "data-id": String(attrs.id) } : {},
      },
      url: { default: null, renderHTML: () => ({}) },
      name: { default: "", renderHTML: () => ({}) },
      mimeType: { default: null, renderHTML: () => ({}) },
      size: { default: null, renderHTML: () => ({}) },
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const raw = element.getAttribute("data-width");
          const n = raw ? Number(raw) : Number.NaN;
          return Number.isFinite(n) ? n : null;
        },
        renderHTML: (attrs: Record<string, unknown>) =>
          typeof attrs.width === "number"
            ? { "data-width": String(attrs.width) }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-chip="attachment"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-chip": "attachment" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AttachmentView, {
      // `@tiptap/core`'s default `stopEvent` only lets ProseMirror handle a
      // native `dragstart` itself when `event.target` is exactly the outer
      // node view node. In our case, though, the visible, actually-dragged
      // element always sits one level deeper (`<img>` in
      // `AttachmentView.tsx`) — Tiptap silently swallows every real drag
      // this way, and ProseMirror's own `dragstart` handler (which sets
      // `view.dragging` for the subsequent move) never runs. A drop then
      // falls back to raw HTML parsing, which matches the `image` node from
      // `RichTextEditor.tsx` instead of `attachment` — visible as a second,
      // different-kind node, while the original either stays put or gets
      // removed uncontrolled by the browser itself. Drag events are
      // therefore always passed through to ProseMirror, regardless of the
      // exact target; for everything else (clicking the remove button etc.)
      // the previous rule of thumb still applies.
      stopEvent: ({ event }) => {
        if (event.type.startsWith("drag")) return false;
        const target = event.target as HTMLElement;
        return ["INPUT", "BUTTON", "SELECT", "TEXTAREA"].includes(
          target.tagName,
        );
      },
      // `@tiptap/react`'s `ReactNodeView.update()` skips updating its own
      // cached position (`currentPos`) as soon as ProseMirror passes along
      // the same node object reference (e.g. when only sibling content
      // before the node changes, without touching this node itself — which
      // is exactly what happens after a move, once typing continues
      // somewhere before it). The selection outline
      // (`handleSelectionUpdate`) then compares against the wrong, stale
      // position — a click on the (correctly moved) attachment no longer
      // selects it, and the resize handles stay off. A custom `update`
      // function makes Tiptap refresh `currentPos` on every call.
      update: ({ updateProps }) => {
        updateProps();
        return true;
      },
    });
  },
});
