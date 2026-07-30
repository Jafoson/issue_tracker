"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Markdown } from "@/components/ui/atoms/Markdown/Markdown";
import { onActivate } from "@/lib/a11y";
import {
  type MarkdownAction,
  MarkdownToolbar,
} from "./components/MarkdownToolbar";
import styles from "./editableMarkdown.module.scss";

/** Auszeichnungen, die die Auswahl umschließen. */
const WRAPS: Partial<Record<MarkdownAction, [string, string]>> = {
  bold: ["**", "**"],
  italic: ["*", "*"],
  strikethrough: ["~~", "~~"],
  code: ["`", "`"],
};

/** Auszeichnungen, die vor jeder Zeile der Auswahl stehen. */
const PREFIXES: Partial<Record<MarkdownAction, string>> = {
  heading: "## ",
  bulletList: "- ",
  numberedList: "1. ",
  quote: "> ",
};

const URL_PLACEHOLDER = "https://";

interface Edit {
  text: string;
  selection: [number, number];
}

interface EditableMarkdownProps {
  value: string;
  /** Läuft beim Verlassen des Editors — und nur, wenn sich etwas geändert hat. */
  onCommit: (value: string) => void;
  /** Barrierefreier Name: der Text trägt kein sichtbares Label. */
  label: string;
  /** Steht anstelle des Texts, solange nichts geschrieben wurde. */
  placeholder?: string;
  /** Beschriftungen der beiden Knöpfe — bitte lokalisiert übergeben. */
  saveLabel?: string;
  cancelLabel?: string;
  /** Typografie des umgebenden Texts. */
  className?: string;
}

/**
 * Markdown, das sich anfassen lässt: im Ruhezustand der gerenderte Text, nach
 * einem Klick ein Eingabefeld mit Werkzeugleiste. Übernommen wird beim
 * Verlassen des Editors, mit ⌘/Strg + Enter oder über den Haken; verworfen mit
 * Escape oder dem Kreuz.
 */
export function EditableMarkdown({
  value,
  onCommit,
  label,
  placeholder,
  saveLabel = "Save",
  cancelLabel = "Cancel",
  className,
}: EditableMarkdownProps) {
  const t = useTranslations("markdown");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(value);
  const [source, setSource] = useState(value);
  const [isEditing, setIsEditing] = useState(false);
  // Auswahl, die nach dem nächsten Rendern gesetzt werden soll — der Wert des
  // Feldes ist kontrolliert, also steht der neue Text erst danach im DOM.
  const pendingSelection = useRef<[number, number] | null>(null);

  // Ein neuer Wert von außen gewinnt; während des Bearbeitens bleibt er außen
  // vor, sonst überschreibt eine eintreffende Antwort das Getippte. Angleich
  // beim Rendern statt per Effekt.
  if (!isEditing && source !== value) {
    setSource(value);
    setDraft(value);
  }

  useLayoutEffect(() => {
    const selection = pendingSelection.current;
    if (!selection || !inputRef.current) return;
    pendingSelection.current = null;
    inputRef.current.focus();
    inputRef.current.setSelectionRange(selection[0], selection[1]);
  });

  /**
   * Escape darf nicht bis zum Modal durchschlagen, sonst schließt sich beim
   * Verwerfen gleich das ganze Panel. Am `window` mit Capture, damit es vor dem
   * Handler des ModalContext (auf `document`) liegt.
   */
  useEffect(() => {
    if (!isEditing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setDraft(value);
      setIsEditing(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isEditing, value]);

  const startEditing = () => {
    setIsEditing(true);
    // Der Effekt unten setzt daraufhin den Fokus ans Ende des Texts.
    pendingSelection.current = [draft.length, draft.length];
  };

  const cancel = () => {
    setDraft(value);
    setIsEditing(false);
  };

  const commit = () => {
    setIsEditing(false);
    if (draft !== value) onCommit(draft);
  };

  const replace = ({ text, selection }: Edit) => {
    setDraft(text);
    pendingSelection.current = selection;
  };

  /** Setzt die Marker um die Auswahl — oder nimmt sie wieder weg. */
  const wrapSelection = (
    start: number,
    end: number,
    [open, close]: [string, string],
  ): Edit => {
    const selected = draft.slice(start, end);
    const isWrapped =
      selected.length >= open.length + close.length &&
      selected.startsWith(open) &&
      selected.endsWith(close);
    const inner = isWrapped
      ? selected.slice(open.length, selected.length - close.length)
      : selected;
    const body = isWrapped ? inner : `${open}${inner}${close}`;

    return {
      text: draft.slice(0, start) + body + draft.slice(end),
      selection: isWrapped
        ? [start, start + body.length]
        : [start + open.length, start + open.length + inner.length],
    };
  };

  /** Stellt jeder berührten Zeile den Marker voran — oder nimmt ihn weg. */
  const prefixLines = (
    start: number,
    end: number,
    prefix: string,
    numbered: boolean,
  ): Edit => {
    const from = draft.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = draft.indexOf("\n", end);
    const to = lineEnd === -1 ? draft.length : lineEnd;
    const lines = draft.slice(from, to).split("\n");
    const marker = (index: number) => (numbered ? `${index + 1}. ` : prefix);
    const isPrefixed = lines.every((line, index) =>
      line.startsWith(marker(index)),
    );
    const next = lines
      .map((line, index) =>
        isPrefixed ? line.slice(marker(index).length) : marker(index) + line,
      )
      .join("\n");

    return {
      text: draft.slice(0, from) + next + draft.slice(to),
      selection: [from, from + next.length],
    };
  };

  /** Fügt Link oder Bild ein und wählt die Adresse aus, damit sie direkt überschrieben wird. */
  const insertTarget = (
    start: number,
    end: number,
    action: MarkdownAction,
  ): Edit => {
    const isImage = action === "image";
    const bang = isImage ? "!" : "";
    const text =
      draft.slice(start, end) || t(isImage ? "imageAlt" : "linkText");
    const body = `${bang}[${text}](${URL_PLACEHOLDER})`;
    const urlStart = start + bang.length + text.length + 3;

    return {
      text: draft.slice(0, start) + body + draft.slice(end),
      selection: [urlStart, urlStart + URL_PLACEHOLDER.length],
    };
  };

  const apply = (action: MarkdownAction) => {
    const input = inputRef.current;
    if (!input) return;
    const { selectionStart: start, selectionEnd: end } = input;

    const wrap = WRAPS[action];
    if (wrap) return replace(wrapSelection(start, end, wrap));

    const prefix = PREFIXES[action];
    if (prefix)
      return replace(
        prefixLines(start, end, prefix, action === "numberedList"),
      );

    replace(insertTarget(start, end, action));
  };

  if (!isEditing) {
    return (
      <div className={[styles.wrap, className].filter(Boolean).join(" ")}>
        {/* biome-ignore lint/a11y/useSemanticElements: enthält Absätze und Listen — ein <button> wäre ungültiges HTML */}
        <div
          className={styles.preview}
          role="button"
          tabIndex={0}
          aria-label={label}
          // Ein Klick auf einen Link im Text soll dorthin führen, nicht ins Feld.
          onClick={(e) => {
            if (!(e.target as HTMLElement).closest("a")) startEditing();
          }}
          onKeyDown={onActivate(startEditing)}
        >
          {draft ? (
            <Markdown>{draft}</Markdown>
          ) : (
            <span className={styles.placeholder}>{placeholder}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={[styles.wrap, className].filter(Boolean).join(" ")}>
      {/* Werkzeugleiste und Feld gehören zusammen, deshalb ein `fieldset`. Der
          Fokus wandert zwischen beiden — erst wenn er den Editor ganz verlässt,
          wird übernommen. */}
      <fieldset
        className={styles.editor}
        onBlur={(e) => {
          if (e.currentTarget.contains(e.relatedTarget)) return;
          commit();
        }}
      >
        <MarkdownToolbar onAction={apply} />
        <textarea
          ref={inputRef}
          className={styles.input}
          aria-label={label}
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              commit();
            }
          }}
        />
      </fieldset>

      <div className={styles.actions}>
        <Button
          variant="ghost"
          size="sm"
          tabIndex={-1}
          icon={<Icon icon="lucide:x" width={15} />}
          aria-label={cancelLabel}
          title={cancelLabel}
          onMouseDown={(e) => e.preventDefault()}
          onClick={cancel}
        />
        <Button
          variant="primary"
          size="sm"
          tabIndex={-1}
          icon={<Icon icon="lucide:check" width={15} />}
          aria-label={saveLabel}
          title={saveLabel}
          onMouseDown={(e) => e.preventDefault()}
          onClick={commit}
        />
      </div>
    </div>
  );
}
