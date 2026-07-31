"use client";

import { Icon } from "@iconify/react";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { useTranslations } from "next-intl";
import { Fragment } from "react";
import { modKey } from "@/lib/a11y";
import styles from "./editorToolbar.module.scss";

/**
 * Die Werkzeugleiste über dem Editor.
 *
 * Sie zeigt nur, was man oft braucht — alles Weitere steht im `/`-Menü. Jeder
 * Knopf leuchtet, wenn die Auszeichnung an der Cursorposition gerade gilt.
 *
 * Der aktive Zustand kommt über `useEditorState`: das rechnet einmal pro
 * Transaktion und rendert nur neu, wenn sich am Ergebnis etwas ändert. Ohne das
 * würde jede Taste die ganze Leiste neu zeichnen.
 */

/** Zugleich der Schlüssel in `messages/*.json` unter `editor`. */
type ToolId =
  | "bold"
  | "italic"
  | "strikethrough"
  | "code"
  | "heading"
  | "bulletList"
  | "numberedList"
  | "taskList"
  | "quote"
  | "link"
  | "image";

interface ToolButton {
  id: ToolId;
  icon: string;
  /** Tastenkürzel, das im Tooltip hinter dem Namen steht. */
  shortcut?: string;
  /** `onLink` öffnet die Adresszeile des Editors. */
  run: (editor: Editor, onLink: () => void) => void;
  /** Wann der Knopf als aktiv gilt. */
  active?: (editor: Editor) => boolean;
}

const GROUPS: ToolButton[][] = [
  [
    {
      id: "bold",
      icon: "lucide:bold",
      run: (e) => e.chain().focus().toggleBold().run(),
      active: (e) => e.isActive("bold"),
    },
    {
      id: "italic",
      icon: "lucide:italic",
      run: (e) => e.chain().focus().toggleItalic().run(),
      active: (e) => e.isActive("italic"),
    },
    {
      id: "strikethrough",
      icon: "lucide:strikethrough",
      run: (e) => e.chain().focus().toggleStrike().run(),
      active: (e) => e.isActive("strike"),
    },
    {
      id: "code",
      icon: "lucide:code",
      run: (e) => e.chain().focus().toggleCode().run(),
      active: (e) => e.isActive("code"),
    },
  ],
  [
    {
      id: "heading",
      icon: "lucide:heading",
      run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
      active: (e) => e.isActive("heading", { level: 2 }),
    },
    {
      id: "bulletList",
      icon: "lucide:list",
      run: (e) => e.chain().focus().toggleBulletList().run(),
      active: (e) => e.isActive("bulletList"),
    },
    {
      id: "numberedList",
      icon: "lucide:list-ordered",
      run: (e) => e.chain().focus().toggleOrderedList().run(),
      active: (e) => e.isActive("orderedList"),
    },
    {
      id: "taskList",
      icon: "lucide:list-checks",
      run: (e) => e.chain().focus().toggleTaskList().run(),
      active: (e) => e.isActive("taskList"),
    },
    {
      id: "quote",
      icon: "lucide:quote",
      run: (e) => e.chain().focus().toggleBlockquote().run(),
      active: (e) => e.isActive("blockquote"),
    },
  ],
  [
    {
      id: "link",
      icon: "lucide:link",
      shortcut: "K",
      // Setzen, ändern und entfernen macht die Adresszeile — sie kennt den
      // bestehenden Link und bietet dann auch das Lösen an.
      run: (_editor, onLink) => onLink(),
      active: (e) => e.isActive("link"),
    },
    {
      id: "image",
      icon: "lucide:image",
      run: (e) => {
        const src = window.prompt("https://");
        if (src) e.chain().focus().setImage({ src }).run();
      },
    },
  ],
];

interface EditorToolbarProps {
  editor: Editor | null;
  /** Öffnet die Adresszeile für Links. */
  onLink: () => void;
}

export function EditorToolbar({ editor, onLink }: EditorToolbarProps) {
  const t = useTranslations("editor");

  const active = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return {} as Record<string, boolean>;
      const state: Record<string, boolean> = {};
      for (const group of GROUPS)
        for (const button of group)
          state[button.id] = button.active?.(editor) ?? false;
      return state;
    },
  });

  if (!editor) return null;

  return (
    <div className={styles.toolbar} role="toolbar" aria-label={t("toolbar")}>
      {GROUPS.map((group, index) => (
        <Fragment key={group[0].id}>
          {index > 0 && <span className={styles.divider} />}
          {group.map((button) => (
            <button
              key={button.id}
              type="button"
              className={styles.btn}
              data-active={active?.[button.id] ? "" : undefined}
              aria-pressed={button.active ? !!active?.[button.id] : undefined}
              aria-label={t(button.id)}
              title={
                button.shortcut
                  ? `${t(button.id)} (${modKey()} + ${button.shortcut})`
                  : t(button.id)
              }
              // Der Fokus muss im Text bleiben — sonst verliert der Befehl die
              // Auswahl, auf die er sich bezieht.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => button.run(editor, onLink)}
            >
              <Icon icon={button.icon} width={15} />
            </button>
          ))}
        </Fragment>
      ))}
    </div>
  );
}
