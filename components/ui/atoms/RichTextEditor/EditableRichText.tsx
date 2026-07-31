"use client";

import { Icon } from "@iconify/react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { RichText } from "@/components/ui/atoms/RichText/RichText";
import { onActivate } from "@/lib/a11y";
import { isEmptyDoc, toDoc } from "@/lib/richtext/doc";
import type { PMDoc } from "@/lib/richtext/types";
import styles from "./editableRichText.module.scss";
import type { IssueSource, MentionSource } from "./RichTextEditor";

/**
 * Text, der sich anfassen lässt: im Ruhezustand das gerenderte Dokument, nach
 * einem Klick der Editor. Übernommen wird beim Verlassen, mit ⌘/Strg + Enter
 * oder über den Haken; verworfen mit Escape oder dem Kreuz.
 *
 * Der Editor kommt per `next/dynamic` — solange niemand schreibt, lädt der
 * Browser das Tiptap-Bündel gar nicht erst. Gelesen wird viel öfter als
 * geschrieben, und die Anzeige braucht davon nichts.
 */

const RichTextEditor = dynamic(
  () => import("./RichTextEditor").then((m) => m.RichTextEditor),
  {
    // ProseMirror braucht ein echtes DOM; Vorrendern brächte nur einen
    // abweichenden ersten Baum.
    ssr: false,
    loading: () => <div className={styles.loading} />,
  },
);

interface EditableRichTextProps {
  value: PMDoc | unknown;
  /** Läuft beim Verlassen des Editors — und nur, wenn sich etwas geändert hat. */
  onCommit: (value: PMDoc) => void;
  /**
   * Läuft bei jedem Tastendruck. Nötig überall dort, wo jemand anderes den Wert
   * abschickt, ohne auf das Verlassen des Feldes zu warten: im Anlegen-Fenster
   * greift ⌘/Strg + Enter am `document` und liefe sonst dem `onCommit` von
   * hier voraus — das Issue entstünde ohne den zuletzt getippten Text.
   */
  onChange?: (value: PMDoc) => void;
  /** Barrierefreier Name: der Text trägt kein sichtbares Label. */
  label: string;
  placeholder?: string;
  saveLabel?: string;
  cancelLabel?: string;
  /**
   * Haken und Kreuz unter dem Feld. Aus, wo ein Dialog schon eigene Knöpfe
   * trägt — im Anlegen-Fenster stünden zwei „Fertig" untereinander.
   * Übernommen wird dann still beim Verlassen oder mit ⌘/Strg + Enter.
   */
  actions?: boolean;
  members?: MentionSource[];
  issues?: IssueSource[];
  className?: string;
}

export function EditableRichText({
  value,
  onCommit,
  onChange,
  label,
  placeholder,
  saveLabel = "Save",
  cancelLabel = "Cancel",
  actions = true,
  members,
  issues,
  className,
}: EditableRichTextProps) {
  const [draft, setDraft] = useState<PMDoc>(() => toDoc(value));
  const [source, setSource] = useState(value);
  const [isEditing, setIsEditing] = useState(false);
  // Der Vergleich läuft über den serialisierten Stand: zwei Dokumente sind
  // gleich, wenn ihr JSON gleich ist, und `onUpdate` liefert bei jedem
  // Tastendruck ein neues Objekt.
  const committed = useRef(JSON.stringify(toDoc(value)));
  /**
   * Ob die Maustaste gerade im Editor gedrückt ist.
   *
   * Der Ziehgriff zum Vergrößern ist kein fokussierbares Element: Ziehen nimmt
   * dem Text den Fokus und gibt ihn an niemanden weiter — `relatedTarget` ist
   * `null`. Für `onBlur` unten sieht das aus wie ein Klick nach draußen, und
   * das Feld würde mitten im Ziehen zuklappen. Der Merker hält es offen.
   */
  const pressedInside = useRef(false);

  // Ein neuer Wert von außen gewinnt; während des Bearbeitens bleibt er außen
  // vor, sonst überschriebe eine eintreffende Antwort das Getippte. Angleich
  // beim Rendern statt per Effekt.
  if (!isEditing && source !== value) {
    setSource(value);
    setDraft(toDoc(value));
    committed.current = JSON.stringify(toDoc(value));
  }

  const cancel = () => {
    setDraft(toDoc(value));
    setIsEditing(false);
  };

  /**
   * Escape darf nicht bis zum Modal durchschlagen, sonst schließt sich beim
   * Verwerfen gleich das ganze Panel. Am `window` mit Capture, damit es vor dem
   * Handler des ModalContext (auf `document`) liegt.
   *
   * Die Vorschlagslisten fangen Escape schon vorher ab und halten es auf —
   * dort schließt es nur die Liste.
   */
  useEffect(() => {
    if (!isEditing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setDraft(toDoc(value));
      setIsEditing(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isEditing, value]);

  useEffect(() => {
    if (!isEditing) return;
    const release = () => {
      pressedInside.current = false;
    };
    window.addEventListener("mouseup", release);
    return () => window.removeEventListener("mouseup", release);
  }, [isEditing]);

  const commit = () => {
    setIsEditing(false);
    const next = JSON.stringify(draft);
    if (next !== committed.current) {
      committed.current = next;
      onCommit(draft);
    }
  };

  if (!isEditing) {
    return (
      <div className={className}>
        {/* biome-ignore lint/a11y/useSemanticElements: enthält Absätze und Listen — ein <button> wäre ungültiges HTML */}
        <div
          className={styles.preview}
          role="button"
          tabIndex={0}
          aria-label={label}
          // Ein Klick auf einen Link im Text soll dorthin führen, nicht ins Feld.
          onClick={(e) => {
            if (!(e.target as HTMLElement).closest("a")) setIsEditing(true);
          }}
          onKeyDown={onActivate(() => setIsEditing(true))}
        >
          {isEmptyDoc(draft) ? (
            <span className={styles.placeholder}>{placeholder}</span>
          ) : (
            <RichText value={draft} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Werkzeugleiste und Schreibfläche gehören zusammen, deshalb ein
          `fieldset`. Der Fokus wandert zwischen beiden — erst wenn er den
          Editor ganz verlässt, wird übernommen. */}
      <fieldset
        className={styles.shell}
        onMouseDown={() => {
          pressedInside.current = true;
        }}
        onBlur={(e) => {
          if (e.currentTarget.contains(e.relatedTarget)) return;
          // Am Ziehgriff gedrückt: der Fokus ist zwar weg, der Editor aber
          // nicht verlassen. Übernommen wird erst beim nächsten echten Blur.
          if (pressedInside.current) return;
          // Die Vorschlagsliste hängt per Portal am `body`, liegt also außerhalb
          // dieses Baums. Ohne die Ausnahme spränge das Feld beim Klick auf
          // einen Vorschlag zu.
          if (
            (e.relatedTarget as HTMLElement | null)?.closest("[role=listbox]")
          )
            return;
          commit();
        }}
      >
        <RichTextEditor
          value={draft}
          onChange={(doc) => {
            setDraft(doc);
            onChange?.(doc);
          }}
          onSubmit={commit}
          label={label}
          placeholder={placeholder}
          autoFocus
          members={members}
          issues={issues}
        />
      </fieldset>

      {actions && (
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
      )}
    </div>
  );
}
