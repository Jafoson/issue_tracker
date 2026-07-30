"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { Fragment } from "react";
import styles from "../editableMarkdown.module.scss";

export type MarkdownAction =
  | "heading"
  | "bold"
  | "italic"
  | "strikethrough"
  | "bulletList"
  | "numberedList"
  | "quote"
  | "code"
  | "link"
  | "image";

/** Gruppen werden durch einen Strich getrennt: Textstil, Struktur, Einfügen. */
const GROUPS: { action: MarkdownAction; icon: string }[][] = [
  [
    { action: "heading", icon: "lucide:heading" },
    { action: "bold", icon: "lucide:bold" },
    { action: "italic", icon: "lucide:italic" },
    { action: "strikethrough", icon: "lucide:strikethrough" },
  ],
  [
    { action: "bulletList", icon: "lucide:list" },
    { action: "numberedList", icon: "lucide:list-ordered" },
    { action: "quote", icon: "lucide:quote" },
  ],
  [
    { action: "code", icon: "lucide:code" },
    { action: "link", icon: "lucide:link" },
    { action: "image", icon: "lucide:image" },
  ],
];

interface MarkdownToolbarProps {
  onAction: (action: MarkdownAction) => void;
}

/**
 * Werkzeugleiste des Markdown-Editors. Jeder Knopf schreibt die passenden
 * Zeichen an der Auswahl — und nimmt sie beim zweiten Druck wieder weg.
 *
 * Das unterdrückte Mousedown hält den Fokus im Textfeld: sonst verlöre es beim
 * Klick die Auswahl, auf die sich die Aktion gerade bezieht.
 */
export function MarkdownToolbar({ onAction }: MarkdownToolbarProps) {
  const t = useTranslations("markdown");

  return (
    <div className={styles.toolbar} role="toolbar" aria-label={t("toolbar")}>
      {GROUPS.map((group, index) => (
        <Fragment key={group[0].action}>
          {index > 0 && <span className={styles.toolbarDivider} />}
          {group.map(({ action, icon }) => (
            <button
              key={action}
              type="button"
              className={styles.toolBtn}
              aria-label={t(action)}
              title={t(action)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onAction(action)}
            >
              <Icon icon={icon} width={15} />
            </button>
          ))}
        </Fragment>
      ))}
    </div>
  );
}
