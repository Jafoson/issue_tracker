"use client";

import { Icon } from "@iconify/react";
import type { Editor, JSONContent } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { toDoc, toPlainDoc } from "@/lib/richtext/doc";
import type { PMDoc } from "@/lib/richtext/types";
import richText from "../RichText/richText.module.scss";
import { EditorToolbar } from "./components/EditorToolbar/EditorToolbar";
import type { SuggestionItem } from "./components/SuggestionMenu/SuggestionMenu";
import {
  DateChip,
  EmojiChip,
  IssueLinkChip,
  MentionChip,
} from "./extensions/chips";
import { searchEmoji } from "./extensions/emojiData";
import { Panel } from "./extensions/Panel";
import { SlashCommand, type SlashCommandItem } from "./extensions/SlashCommand";
import { createSuggestion } from "./extensions/suggestion";
import styles from "./richTextEditor.module.scss";

/**
 * Der Editor. Läuft nur im Browser — geladen wird er von `EditableRichText`
 * per `next/dynamic`, damit das Tiptap-Bündel erst kommt, wenn jemand
 * tatsächlich schreibt.
 *
 * Die fachlichen Daten für `@` und `#` reicht der Aufrufer herein. Diese
 * Komponente liegt in `components/ui` und kennt deshalb weder Workspace noch
 * Prisma.
 */

/**
 * Die Übersetzungsfunktion des `editor`-Namensraums. Eigener Typ, weil
 * `slashItems` sie als Parameter bekommt und `Translator` aus `@/i18n/types`
 * den Wurzel-Namensraum meint.
 */
export type EditorTranslator = ReturnType<typeof useTranslations<"editor">>;

/** Ein Mitglied, wie es der `@`-Trigger braucht. */
export interface MentionSource {
  id: string;
  name: string;
  /** Optionales Bild — als fertiges Element, damit `ui` nichts über Avatare weiß. */
  avatar?: React.ReactNode;
}

/** Ein Issue, wie es der `#`-Trigger braucht. */
export interface IssueSource {
  id: string;
  /** Lesbarer Schlüssel, z.B. `ORB-42`. */
  identifier: string;
  title: string;
  icon?: React.ReactNode;
}

export interface RichTextEditorProps {
  value: PMDoc | unknown;
  onChange: (doc: PMDoc) => void;
  /** Läuft bei ⌘/Strg + Enter. */
  onSubmit?: () => void;
  label: string;
  placeholder?: string;
  autoFocus?: boolean;
  members?: MentionSource[];
  issues?: IssueSource[];
  className?: string;
}

/** Ein Datum ohne Zeitzonen-Überraschung: der Kalendertag vor Ort. */
function isoDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function RichTextEditor({
  value,
  onChange,
  onSubmit,
  label,
  placeholder,
  autoFocus,
  members = [],
  issues = [],
  className,
}: RichTextEditorProps) {
  const t = useTranslations("editor");

  // Die Extensions hängen an den Vorschlagsdaten. Sie werden einmal pro
  // Datenstand gebaut — `useEditor` baut den Editor sonst bei jedem Tastendruck
  // neu auf und der Cursor springt.
  const extensions = useMemo(() => {
    const mention = MentionChip.configure({
      suggestion: createSuggestion<SuggestionItem>({
        name: "mentionSuggestion",
        char: "@",
        // Namen bestehen oft aus zwei Wörtern — ohne das bräche die Suche
        // nach dem ersten Leerzeichen ab.
        allowSpaces: true,
        emptyLabel: () => t("noMembers"),
        items: (query) => {
          const q = query.trim().toLowerCase();
          return members
            .filter((m) => !q || m.name.toLowerCase().includes(q))
            .slice(0, 8)
            .map((m) => ({ id: m.id, label: m.name, icon: m.avatar }));
        },
        onSelect: ({ editor, range, item }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              { type: "mention", attrs: { id: item.id, label: item.label } },
              // Ohne das Leerzeichen klebt das nächste Wort am Chip.
              { type: "text", text: " " },
            ])
            .run();
        },
      }),
    });

    const issueLink = IssueLinkChip.configure({
      suggestion: createSuggestion<SuggestionItem>({
        name: "issueLinkSuggestion",
        char: "#",
        emptyLabel: () => t("noIssues"),
        items: (query) => {
          const q = query.trim().toLowerCase();
          return issues
            .filter(
              (i) =>
                !q ||
                i.title.toLowerCase().includes(q) ||
                i.identifier.toLowerCase().includes(q),
            )
            .slice(0, 8)
            .map((i) => ({
              id: i.id,
              label: i.title,
              hint: i.identifier,
              icon: i.icon,
            }));
        },
        onSelect: ({ editor, range, item }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              {
                type: "issueLink",
                attrs: { id: item.id, identifier: item.hint ?? "" },
              },
              { type: "text", text: " " },
            ])
            .run();
        },
      }),
    });

    const emoji = EmojiChip.configure({
      suggestion: createSuggestion<SuggestionItem>({
        name: "emojiSuggestion",
        char: ":",
        emptyLabel: () => t("noEmoji"),
        items: (query) =>
          // Erst ab zwei Zeichen — sonst geht die Liste bei jedem Doppelpunkt
          // in einem Verhältnis wie `10:30` auf.
          query.length < 2
            ? []
            : searchEmoji(query).map((e) => ({
                id: e.name,
                label: e.name,
                hint: e.emoji,
              })),
        onSelect: ({ editor, range, item }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              {
                type: "emoji",
                attrs: { name: item.id, emoji: item.hint ?? "" },
              },
              { type: "text", text: " " },
            ])
            .run();
        },
      }),
    });

    const slash = SlashCommand.configure({
      suggestion: createSuggestion<SlashCommandItem>({
        name: "slashCommand",
        char: "/",
        emptyLabel: () => t("noCommands"),
        items: (query) => {
          const q = query.trim().toLowerCase();
          const all = slashItems(t);
          if (!q) return all;

          const hits = all.filter(
            (item) =>
              item.label.toLowerCase().includes(q) ||
              item.id.toLowerCase().includes(q),
          );

          // Wer `/ta` tippt, meint „Tabelle", nicht „Nummerierte Liste" (die
          // das `ta` in der Mitte trägt). Treffer am Wortanfang deshalb nach
          // vorn; innerhalb der beiden Ränge bleibt die Reihenfolge oben
          // erhalten, weil `sort` stabil ist.
          const startsWith = (item: SlashCommandItem) =>
            item.label.toLowerCase().startsWith(q) ||
            item.id.toLowerCase().startsWith(q)
              ? 0
              : 1;

          return (
            hits
              .sort((a, b) => startsWith(a) - startsWith(b))
              // Beim Suchen ohne Gruppenköpfe: die Rangfolge zieht Einträge aus
              // verschiedenen Gruppen durcheinander, und dieselbe Überschrift
              // stünde dann mehrfach in der Liste. Gegliedert wird die
              // vollständige Liste, gesucht wird eine flache Rangfolge.
              .map((item) => ({ ...item, group: undefined }))
          );
        },
        onSelect: ({ editor, range, item }) => item.run({ editor, range }),
      }),
    });

    return [
      StarterKit.configure({
        // Eigene Erweiterungen — die Voreinstellungen des Kits würden sie sonst
        // doppelt registrieren.
        link: false,
        // `codeBlock` und der Rest bleiben, wie das Kit sie mitbringt.
      }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: true } }),
      Panel,
      // Der Hinweis auf das `/`-Menü steht im Platzhalter, nicht in der
      // Werkzeugleiste: dort sah man ihn immer, gebraucht wird er aber genau
      // dann, wenn das Feld noch leer ist.
      Placeholder.configure({
        placeholder: placeholder
          ? t("placeholderWithHint", { placeholder, hint: t("slashHint") })
          : t("slashHint"),
      }),
      mention,
      issueLink,
      emoji,
      // Ohne eigenen Trigger — Datums-Chips kommen aus dem `/`-Menü. Die
      // Erweiterung muss trotzdem geladen sein, sonst kennt das Schema den
      // Knoten nicht und `insertContent` verwirft ihn stillschweigend.
      DateChip,
      slash,
    ];
  }, [members, issues, placeholder, t]);

  const editor = useEditor({
    extensions,
    // `PMDoc` beschreibt Attribute als `unknown`, Tiptap als `any` — inhaltlich
    // dasselbe Dokument, nur strenger typisiert. Die Umdeutung bleibt auf diese
    // eine Stelle beschränkt.
    content: toDoc(value) as JSONContent,
    autofocus: autoFocus ? "end" : false,
    // Next rendert Client-Komponenten auch auf dem Server vor; ProseMirror darf
    // dabei nicht sofort loslaufen, sonst weicht der erste Client-Baum ab.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: `${richText.richText} ${styles.surface}`,
        "aria-label": label,
        role: "textbox",
        "aria-multiline": "true",
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          onSubmit?.();
          return true;
        }
        return false;
      },
    },
    // `toPlainDoc` ist Pflicht, nicht Vorsicht: ProseMirrors Attribute haben
    // keinen Prototyp und überleben den Weg zu einer Server Function nicht.
    onUpdate: ({ editor }) => onChange(toPlainDoc(editor.getJSON() as PMDoc)),
  });

  return (
    <div className={[styles.editor, className].filter(Boolean).join(" ")}>
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} className={styles.content} />
    </div>
  );
}

/**
 * Die Einträge des `/`-Menüs.
 *
 * Reihenfolge nach dem, was in einem Issue tatsächlich getippt wird — nicht
 * nach der Ordnung der Auszeichnungssprache:
 *
 * - **Listen zuerst.** Aufzählungen gliedern fast jede Beschreibung, und
 *   Checklisten tragen Akzeptanzkriterien und Teilaufgaben. Das ist der
 *   häufigste Griff überhaupt.
 * - **Dann Überschriften.** „Schritte zur Reproduktion", „Erwartet",
 *   „Tatsächlich" — Gliederung kommt gleich danach. Innerhalb der Gruppe
 *   bleibt es bei 1, 2, 3: eine umsortierte Zahlenfolge liest sich wie ein
 *   Fehler, auch wenn Ebene 2 öfter gebraucht wird.
 * - **Blöcke, Codeblock voran.** Logs und Stapelspuren sind in einem
 *   Fehlerbericht Alltag; Zitat, Panels, Tabelle und Trennlinie folgen.
 * - **Einfügen zuletzt.** Erwähnung und Issue haben mit `@` und `#` eigene
 *   Auslöser — hier stehen sie nur, damit man sie findet. Die drei
 *   Datumsangaben ganz ans Ende: sie belegen sonst drei Zeilen im Sichtfeld
 *   für etwas, das selten gebraucht wird.
 */
function slashItems(t: EditorTranslator): SlashCommandItem[] {
  /** Erst den `/…`-Text wegnehmen, dann den Befehl ausführen. */
  const at = (editor: Editor, range: { from: number; to: number }) =>
    editor.chain().focus().deleteRange(range);

  return [
    // ── Listen ───────────────────────────────────────────────────────────────
    {
      id: "bulletList",
      label: t("bulletList"),
      group: t("groupLists"),
      icon: <Icon icon="lucide:list" width={16} />,
      run: ({ editor, range }) => at(editor, range).toggleBulletList().run(),
    },
    {
      id: "taskList",
      label: t("taskList"),
      group: t("groupLists"),
      icon: <Icon icon="lucide:list-checks" width={16} />,
      run: ({ editor, range }) => at(editor, range).toggleTaskList().run(),
    },
    {
      id: "orderedList",
      label: t("numberedList"),
      group: t("groupLists"),
      icon: <Icon icon="lucide:list-ordered" width={16} />,
      run: ({ editor, range }) => at(editor, range).toggleOrderedList().run(),
    },

    // ── Text ─────────────────────────────────────────────────────────────────
    {
      id: "heading1",
      label: t("heading1"),
      group: t("groupText"),
      icon: <Icon icon="lucide:heading-1" width={16} />,
      run: ({ editor, range }) =>
        at(editor, range).setNode("heading", { level: 1 }).run(),
    },
    {
      id: "heading2",
      label: t("heading2"),
      group: t("groupText"),
      icon: <Icon icon="lucide:heading-2" width={16} />,
      run: ({ editor, range }) =>
        at(editor, range).setNode("heading", { level: 2 }).run(),
    },
    {
      id: "heading3",
      label: t("heading3"),
      group: t("groupText"),
      icon: <Icon icon="lucide:heading-3" width={16} />,
      run: ({ editor, range }) =>
        at(editor, range).setNode("heading", { level: 3 }).run(),
    },

    // ── Blöcke ───────────────────────────────────────────────────────────────
    {
      id: "codeBlock",
      label: t("codeBlock"),
      group: t("groupBlocks"),
      icon: <Icon icon="lucide:code" width={16} />,
      run: ({ editor, range }) => at(editor, range).toggleCodeBlock().run(),
    },
    {
      id: "blockquote",
      label: t("quote"),
      group: t("groupBlocks"),
      icon: <Icon icon="lucide:quote" width={16} />,
      run: ({ editor, range }) => at(editor, range).toggleBlockquote().run(),
    },
    {
      id: "infoPanel",
      label: t("infoPanel"),
      group: t("groupBlocks"),
      icon: <Icon icon="lucide:info" width={16} />,
      run: ({ editor, range }) => at(editor, range).togglePanel("info").run(),
    },
    {
      id: "warningPanel",
      label: t("warningPanel"),
      group: t("groupBlocks"),
      icon: <Icon icon="lucide:triangle-alert" width={16} />,
      run: ({ editor, range }) =>
        at(editor, range).togglePanel("warning").run(),
    },
    {
      id: "table",
      label: t("table"),
      group: t("groupBlocks"),
      icon: <Icon icon="lucide:table" width={16} />,
      run: ({ editor, range }) =>
        at(editor, range)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run(),
    },
    {
      id: "horizontalRule",
      label: t("divider"),
      group: t("groupBlocks"),
      icon: <Icon icon="lucide:minus" width={16} />,
      run: ({ editor, range }) => at(editor, range).setHorizontalRule().run(),
    },

    // ── Einfügen ─────────────────────────────────────────────────────────────
    {
      id: "mention",
      label: t("mention"),
      hint: "@",
      group: t("groupInsert"),
      icon: <Icon icon="lucide:at-sign" width={16} />,
      // Den Trigger einfach schreiben — daraufhin geht dessen eigene Liste auf.
      run: ({ editor, range }) => at(editor, range).insertContent("@").run(),
    },
    {
      id: "issue",
      label: t("issueLink"),
      hint: "#",
      group: t("groupInsert"),
      icon: <Icon icon="lucide:hash" width={16} />,
      run: ({ editor, range }) => at(editor, range).insertContent("#").run(),
    },
    {
      id: "date",
      label: t("date"),
      hint: t("today"),
      group: t("groupInsert"),
      icon: <Icon icon="lucide:calendar" width={16} />,
      run: ({ editor, range }) =>
        at(editor, range)
          .insertContent([
            { type: "dateChip", attrs: { date: isoDate() } },
            { type: "text", text: " " },
          ])
          .run(),
    },
    {
      id: "dateTomorrow",
      label: t("dateTomorrow"),
      group: t("groupInsert"),
      icon: <Icon icon="lucide:calendar-plus" width={16} />,
      run: ({ editor, range }) =>
        at(editor, range)
          .insertContent([
            { type: "dateChip", attrs: { date: isoDate(1) } },
            { type: "text", text: " " },
          ])
          .run(),
    },
    {
      id: "dateNextWeek",
      label: t("dateNextWeek"),
      group: t("groupInsert"),
      icon: <Icon icon="lucide:calendar-clock" width={16} />,
      run: ({ editor, range }) =>
        at(editor, range)
          .insertContent([
            { type: "dateChip", attrs: { date: isoDate(7) } },
            { type: "text", text: " " },
          ])
          .run(),
    },
  ];
}
