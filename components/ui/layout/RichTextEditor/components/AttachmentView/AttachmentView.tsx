"use client";

import { Icon } from "@iconify/react";
import { NodeSelection } from "@tiptap/pm/state";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { clampAttachmentWidth, formatBytes } from "@/lib/richtext/attachments";
import styles from "./attachmentView.module.scss";

/**
 * An attachment in the editor: image preview, video player, or file card,
 * depending on `mimeType` — the same branching as `RichText.tsx`'s
 * `case "attachment"`, just with a remove button added on top here.
 *
 * If `url` is missing (the attachment was deleted, but the node still sits
 * in the document of an older revision), a quiet placeholder appears
 * instead of a dead image.
 */
/** The eight handles — four corners, four edge midpoints —, each with its
 *  axis and direction. `@tiptap/core` already ships this exact eight-handle
 *  scheme via `ResizableNodeView` (`ResizableNodeViewDirection`); rebuilt
 *  instead of reused because this component is meant to stay React (corners
 *  and edges land here as JSX, not as DOM managed by Tiptap itself) — the
 *  translations for attachment names and the branching by `mimeType` would
 *  otherwise need a second, independent vocabulary. */
const HANDLES: {
  pos: string;
  axis: "x" | "y";
  direction: 1 | -1;
  cursor: string;
}[] = [
  { pos: "tl", axis: "x", direction: -1, cursor: "nwse-resize" },
  { pos: "t", axis: "y", direction: -1, cursor: "ns-resize" },
  { pos: "tr", axis: "x", direction: 1, cursor: "nesw-resize" },
  { pos: "r", axis: "x", direction: 1, cursor: "ew-resize" },
  { pos: "br", axis: "x", direction: 1, cursor: "nwse-resize" },
  { pos: "b", axis: "y", direction: 1, cursor: "ns-resize" },
  { pos: "bl", axis: "x", direction: -1, cursor: "nesw-resize" },
  { pos: "l", axis: "x", direction: -1, cursor: "ew-resize" },
];

export function AttachmentView({
  node,
  extension,
  deleteNode,
  updateAttributes,
  editor,
  getPos,
}: NodeViewProps) {
  const t = useTranslations("editor");
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRef = useRef<HTMLDivElement>(null);

  /**
   * ProseMirror's own coordinate-to-position resolution (`posFromCaret` in
   * `prosemirror-view`) decides a click on an atom node by bisecting its
   * bounding box: left of center → before it, right of center → after it —
   * designed for narrow inline symbols. For a 300px+ wide, tall image this
   * heuristic collapses: if the attachment ends up at the edge of a
   * paragraph after being moved (text only on one side), every click becomes
   * ineffective — no selection, no resize handles. The official workaround
   * (see Tiptap's own examples for large node views, as well as Atlassian's
   * ProseMirror editor for media embeds): don't leave selection to the
   * browser/ProseMirror click heuristic, and instead set it here directly via
   * the node's own, always-current position (`getPos()`).
   */
  const selectSelf = () => {
    const pos = getPos();
    if (typeof pos !== "number") return;
    editor.commands.setNodeSelection(pos);
  };

  /**
   * `@tiptap/react`'s own `selected` prop relies on an internally cached
   * position (`currentPos`) that isn't always updated on a subsequent
   * `update()` of the same node view object when ProseMirror passes along
   * the same node reference — visible precisely in the cases where
   * `selectSelf()` above kicks in (attachment moved to a paragraph edge):
   * the actual selection (`editor.state.selection`) is then a correct
   * `NodeSelection` at that position, yet the `selected` prop still stays
   * `false`. So it's tracked here manually instead, always compared against
   * the fresh `getPos()` rather than a cached value.
   */
  const [isSelected, setIsSelected] = useState(false);
  const getPosRef = useRef(getPos);
  getPosRef.current = getPos;
  useEffect(() => {
    const sync = () => {
      const pos = getPosRef.current();
      const sel = editor.state.selection;
      setIsSelected(
        typeof pos === "number" &&
          sel instanceof NodeSelection &&
          sel.from === pos,
      );
    };
    sync();
    editor.on("selectionUpdate", sync);
    return () => {
      editor.off("selectionUpdate", sync);
    };
  }, [editor]);

  const id = node.attrs.id as string | null;
  const url = node.attrs.url as string | null;
  const name = (node.attrs.name as string) || "";
  const mimeType = node.attrs.mimeType as string | null;
  const size = node.attrs.size as number | null;
  const width = clampAttachmentWidth(node.attrs.width);
  const onRemove = extension.options.onRemove as
    | ((id: string) => Promise<void>)
    | null;

  /**
   * Drags the width from a corner or edge midpoint — corners and the side
   * edges track horizontal mouse movement, top/bottom track vertical
   * movement, converted via the aspect ratio (`aspectRatio`), since only the
   * width is actually stored and the height simply follows it via
   * `height: auto`. Same mechanism as resizing the editor itself
   * (`richTextEditor.module.scss`'s `resize: vertical`): while dragging, the
   * width only runs through the DOM style (no node update per pixel, which
   * would flood ProseMirror's history with hundreds of steps), and it's only
   * committed on release.
   */
  const startResize =
    (axis: "x" | "y", direction: 1 | -1) => (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const el = mediaRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const aspectRatio = rect.width / rect.height || 1;
      const startPos = axis === "x" ? e.clientX : e.clientY;
      const startWidth = rect.width;
      const widthAt = (pos: number) => {
        const deltaPos = (pos - startPos) * direction;
        const deltaWidth = axis === "x" ? deltaPos : deltaPos * aspectRatio;
        return clampAttachmentWidth(startWidth + deltaWidth);
      };

      const onMove = (ev: PointerEvent) => {
        el.style.width = `${widthAt(axis === "x" ? ev.clientX : ev.clientY)}px`;
      };
      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        updateAttributes({
          width: widthAt(axis === "x" ? ev.clientX : ev.clientY),
        });
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };

  /** Only while the attachment is selected — like in any common program,
   *  not just on mouse hover. Mouse-only, like the resize handle of a table
   *  column (`richTextEditor.module.scss`'s `.column-resize-handle`) — the
   *  same exception from keyboard operability already applies there. */
  const resizeHandles =
    isSelected &&
    HANDLES.map((h) => (
      <div
        key={h.pos}
        className={styles.resizeHandle}
        data-pos={h.pos}
        style={{ cursor: h.cursor }}
        onPointerDown={startResize(h.axis, h.direction)}
        aria-hidden="true"
      />
    ));

  const remove = async () => {
    if (!id || !onRemove || isRemoving) return;
    setIsRemoving(true);
    setError(null);
    try {
      await onRemove(id);
      deleteNode();
    } catch {
      setError(t("attachmentRemoveError"));
      setIsRemoving(false);
    }
  };

  const removeButton = onRemove && (
    <button
      type="button"
      className={styles.remove}
      contentEditable={false}
      disabled={isRemoving}
      aria-label={t("attachmentRemove")}
      title={t("attachmentRemove")}
      onClick={remove}
    >
      <Icon icon="lucide:x" width={13} />
    </button>
  );

  if (!url) {
    return (
      <NodeViewWrapper
        className={styles.missing}
        data-kind="missing"
        contentEditable={false}
      >
        <Icon icon="lucide:file-x" width={15} aria-hidden="true" />
        <span>{t("attachmentRemoved")}</span>
      </NodeViewWrapper>
    );
  }

  if (mimeType?.startsWith("image/")) {
    return (
      <NodeViewWrapper
        ref={mediaRef}
        className={styles.image}
        data-kind="image"
        style={{ width, maxWidth: "100%" }}
        contentEditable={false}
        onClick={selectSelf}
      >
        {/* biome-ignore lint/performance/noImgElement: presigned URL, next/image can't optimize it */}
        <img src={url} alt={name} className={styles.imagePreview} />
        {removeButton}
        {resizeHandles}
        {error && <span className={styles.error}>{error}</span>}
      </NodeViewWrapper>
    );
  }

  if (mimeType?.startsWith("video/")) {
    return (
      <NodeViewWrapper
        ref={mediaRef}
        className={styles.video}
        data-kind="video"
        style={{ width, maxWidth: "100%" }}
        contentEditable={false}
        onClick={selectSelf}
      >
        {/* biome-ignore lint/a11y/useMediaCaption: uploaded attachments don't carry subtitles */}
        <video src={url} controls className={styles.videoPlayer} />
        <div className={styles.caption}>
          <span className={styles.name}>{name}</span>
          {size != null && (
            <span className={styles.size}>{formatBytes(size)}</span>
          )}
        </div>
        {removeButton}
        {resizeHandles}
        {error && <span className={styles.error}>{error}</span>}
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      className={styles.file}
      data-kind="file"
      contentEditable={false}
    >
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.fileLink}
      >
        <Icon icon="lucide:file" width={18} aria-hidden="true" />
        <span className={styles.name}>{name}</span>
        {size != null && (
          <span className={styles.size}>{formatBytes(size)}</span>
        )}
      </a>
      {removeButton}
      {error && <span className={styles.error}>{error}</span>}
    </NodeViewWrapper>
  );
}
