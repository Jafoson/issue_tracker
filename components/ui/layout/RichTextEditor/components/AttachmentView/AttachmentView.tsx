"use client";

import { Icon } from "@iconify/react";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { clampAttachmentWidth, formatBytes } from "@/lib/richtext/attachments";
import styles from "./attachmentView.module.scss";

/**
 * Ein Anhang im Editor: Bild-Vorschau, Video-Player oder Datei-Karte, je nach
 * `mimeType` — dieselbe Verzweigung wie in `RichText.tsx`s `case "attachment"`,
 * hier nur zusätzlich mit einer Entfernen-Schaltfläche.
 *
 * Fehlt `url` (Anhang wurde gelöscht, aber der Knoten steht noch im
 * Dokument einer älteren Fassung), erscheint ein stiller Platzhalter statt
 * eines toten Bildes.
 */
/** Die acht Griffe — vier Ecken, vier Kantenmitten —, jeder mit seiner Achse
 *  und Richtung. `@tiptap/core` bringt mit `ResizableNodeView` genau dieses
 *  Achtergriff-Schema bereits mit (`ResizableNodeViewDirection`); nachgebaut
 *  statt übernommen, weil diese Komponente React bleiben soll (Ecken/Kanten
 *  landen hier als JSX, nicht als von Tiptap selbst verwaltetes DOM) — die
 *  Übersetzungen für Anhang-Namen und die Verzweigung nach `mimeType` bräuchten
 *  sonst ein zweites, unabhängiges Vokabular. */
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
  selected,
}: NodeViewProps) {
  const t = useTranslations("editor");
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRef = useRef<HTMLDivElement>(null);

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
   * Zieht die Breite an einer Ecke oder Kantenmitte — Ecken und die
   * Seitenkanten zählen die waagrechte Mausbewegung, oben/unten die
   * senkrechte, umgerechnet über das Seitenverhältnis (`aspectRatio`), da nur
   * die Breite tatsächlich gespeichert wird und die Höhe ihr per
   * `height: auto` einfach folgt. Dieselbe Mechanik wie beim Vergrößern des
   * Editors selbst (`richTextEditor.module.scss`s `resize: vertical`): erst
   * während des Ziehens läuft die Breite nur über den DOM-Stil (kein
   * Node-Update pro Pixel, das würde ProseMirrors Historie mit hunderten
   * Schritten fluten), übernommen wird sie erst beim Loslassen.
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

  /** Nur solange der Anhang ausgewählt ist — wie in jedem gängigen Programm,
   *  nicht erst beim Überfahren mit der Maus. Nur mit der Maus bedienbar,
   *  wie der Ziehgriff einer Tabellenspalte (`richTextEditor.module.scss`s
   *  `.column-resize-handle`) — dieselbe Ausnahme von Tastaturbedienung gilt
   *  schon dort. */
  const resizeHandles =
    selected &&
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
      >
        {/* biome-ignore lint/performance/noImgElement: presignte URL, next/image kann sie nicht optimieren */}
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
      >
        {/* biome-ignore lint/a11y/useMediaCaption: hochgeladene Anhänge tragen keine Untertitel */}
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
