"use client";

import { Icon } from "@iconify/react";
import type { Editor, JSONContent } from "@tiptap/core";
import { mergeAttributes } from "@tiptap/core";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, ReactNodeViewRenderer, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar } from "@/components/ui/atoms/Calendar/Calendar";
import { modKey } from "@/lib/a11y";
import { formatChipDate, isoDate, parseDateInput } from "@/lib/richtext/date";
import { toDoc, toPlainDoc } from "@/lib/richtext/doc";
import { lowlight } from "@/lib/richtext/highlight";
import type { PMDoc } from "@/lib/richtext/types";
import richText from "../../atoms/RichText/richText.module.scss";
import { CodeBlockView } from "./components/CodeBlockView/CodeBlockView";
import { EditorToolbar } from "./components/EditorToolbar/EditorToolbar";
import { LinkForm } from "./components/LinkForm/LinkForm";
import type { SuggestionItem } from "./components/SuggestionMenu/SuggestionMenu";
import { AttachmentNode } from "./extensions/attachment";
import {
  DateChip,
  EmojiChip,
  IssueLinkChip,
  LinkChip,
  MentionChip,
} from "./extensions/chips";
import { searchEmoji } from "./extensions/emojiData";
import { Panel } from "./extensions/Panel";
import {
  filterSlashItems,
  SlashCommand,
  type SlashCommandItem,
} from "./extensions/SlashCommand";
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
  /** Bild für die Vorschlagsliste, als fertiges Element. */
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

/** Was ein erfolgreicher Anhang-Upload an Attributen für den Knoten liefert. */
export interface UploadedAttachment {
  id: string;
  url: string;
  name: string;
  mimeType: string | null;
  size: number | null;
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
  /**
   * Lädt eine Datei hoch (Werkzeugleiste, Drag&Drop, Einfügen aus der
   * Zwischenablage) und liefert die aufgelösten Attribute für den Knoten.
   * Fehlt sie, ist das Feature für diese Editor-Instanz aus (Kommentare,
   * Create-Issue-Composer) — kein Werkzeugleisten-Knopf, kein Abfangen von
   * Dateien beim Ablegen/Einfügen.
   */
  onUploadAttachment?: (
    file: File,
  ) => Promise<UploadedAttachment | { error: string }>;
  /** Löscht einen Anhang serverseitig — an den `attachment`-Knoten gereicht. */
  onRemoveAttachment?: (id: string) => Promise<void>;
  className?: string;
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
  onUploadAttachment,
  onRemoveAttachment,
  className,
}: RichTextEditorProps) {
  const t = useTranslations("editor");
  // Wo das Kalenderblatt steht, solange es offen ist. `null` heißt: zu.
  const [calendar, setCalendar] = useState<{ x: number; y: number } | null>(
    null,
  );
  const editorRef = useRef<Editor | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  /**
   * Lädt hoch und fügt bei Erfolg den Knoten an der Cursor-Position ein — ein
   * Absatz danach, sonst hat der Cursor nach einem Block-Atom keinen Platz,
   * an dem es weitergeht.
   */
  const pickAttachment = useCallback(
    async (file: File) => {
      if (!onUploadAttachment) return;
      setAttachmentError(null);
      const result = await onUploadAttachment(file);
      if ("error" in result) {
        setAttachmentError(result.error);
        return;
      }
      editorRef.current
        ?.chain()
        .focus()
        .insertContent([
          { type: "attachment", attrs: result },
          { type: "paragraph" },
        ])
        .run();
    },
    [onUploadAttachment],
  );

  /**
   * Hängt das Blatt an die Stelle, an der der Cursor gerade steht.
   *
   * Stabil gehalten, weil die Extensions davon abhängen: eine bei jedem Render
   * neue Funktion würde `useMemo` unten entwerten, den Editor neu aufbauen und
   * den Cursor springen lassen. Ref und Setter sind selbst stabil, die leere
   * Liste stimmt also.
   */
  const openCalendar = useCallback(() => {
    const view = editorRef.current?.view;
    if (!view) return;
    const at = view.coordsAtPos(view.state.selection.from);
    setCalendar({ x: at.left, y: at.bottom + 6 });
  }, []);

  /** Wo die Adresszeile steht und womit sie startet. `null` heißt: zu. */
  const [linkAt, setLinkAt] = useState<{
    x: number;
    y: number;
    initial: string;
    withName: boolean;
  } | null>(null);

  /**
   * Öffnet die Adresszeile am Cursor. Steht der Cursor schon in einem Link,
   * ist dessen Adresse vorbelegt — dann wird sie geändert statt neu gesetzt.
   */
  const openLink = useCallback(() => {
    const editor = editorRef.current;
    const view = editor?.view;
    if (!editor || !view) return;
    const at = view.coordsAtPos(view.state.selection.from);
    const current = editor.getAttributes("link").href;
    setLinkAt({
      x: at.left,
      y: at.bottom + 6,
      initial: typeof current === "string" ? current : "",
      // Ohne Markierung entsteht ein Chip — der braucht einen Namen.
      withName: view.state.selection.empty,
    });
  }, []);

  /**
   * Zwei Wege, je nachdem, ob etwas markiert ist:
   *
   * - **Text markiert** → er bekommt die Link-Auszeichnung. Der markierte Text
   *   *ist* der Name; ein Chip würde ihn ersetzen und wäre das Gegenteil des
   *   Erwarteten.
   * - **Nichts markiert** → ein Chip mit Namen und Website-Icon. Eine nackte
   *   Adresse mitten im Satz liest sich schlecht.
   */
  const applyLink = (href: string, name: string) => {
    setLinkAt(null);
    const editor = editorRef.current;
    if (!editor) return;

    if (editor.state.selection.empty) {
      editor
        .chain()
        .focus()
        .insertContent([
          { type: "linkChip", attrs: { href, label: name } },
          // Ohne das Leerzeichen klebt das nächste Wort am Chip.
          { type: "text", text: " " },
        ])
        .run();
      return;
    }
    editor.chain().focus().setLink({ href }).run();
  };

  const removeLink = () => {
    setLinkAt(null);
    editorRef.current?.chain().focus().unsetLink().run();
  };

  /**
   * Schließt eine Einblendung und gibt den Cursor zurück.
   *
   * Ohne das bliebe der Editor zwar offen, aber ohne Fokus: die Adresszeile hat
   * ihn genommen und beim Schließen an niemanden weitergereicht.
   */
  const dismiss = (close: () => void) => () => {
    close();
    editorRef.current?.commands.focus();
  };

  const insertDate = (iso: string) => {
    setCalendar(null);
    editorRef.current
      ?.chain()
      .focus()
      .insertContent([
        { type: "dateChip", attrs: { date: iso } },
        // Ohne das Leerzeichen klebt das nächste Wort am Chip.
        { type: "text", text: " " },
      ])
      .run();
  };

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
          return (
            members
              .filter((m) => !q || m.name.toLowerCase().includes(q))
              .slice(0, 8)
              // Kein `hint`: den zeigt die Liste rechts an, und ein Hex-Code
              // neben jedem Namen wäre Unsinn. Die Farbe holt `onSelect` sich
              // beim Einfügen aus `members`.
              .map((m) => ({ id: m.id, label: m.name, icon: m.avatar }))
          );
        },
        onSelect: ({ editor, range, item }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              {
                type: "mention",
                attrs: { id: item.id, label: item.label },
              },
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

    // `//` ist der Auslöser für Datumsangaben. Er kollidiert nicht mit dem
    // `/`-Menü: sobald der zweite Schrägstrich steht, scheitert dort die
    // Präfix-Prüfung von `@tiptap/suggestion` und die Liste schließt sich.
    const date = DateChip.configure({
      suggestion: createSuggestion<SuggestionItem>({
        name: "dateSuggestion",
        char: "//",
        emptyLabel: () => t("noDates"),
        items: (query) => {
          const q = query.trim().toLowerCase();

          // Etwas Getipptes wie `//1.2.2002` gewinnt und steht allein da.
          const typed = parseDateInput(query);
          if (typed) {
            return [
              {
                id: typed,
                label: formatChipDate(typed),
                hint: t("dateTyped"),
                icon: <Icon icon="lucide:calendar-check" width={16} />,
              },
            ];
          }

          // Genau zwei Kürzel: `//now` und `//tomorrow`. Alles Weitere wird
          // getippt (`//1.2.2002`) oder im Blatt gewählt.
          const presets: { id: string; label: string; key: string }[] = [
            { id: isoDate(), label: t("today"), key: "now" },
            { id: isoDate(1), label: t("tomorrow"), key: "tomorrow" },
          ];

          return [
            ...presets
              // Auch die übersetzte Beschriftung trifft — wer `//heu` tippt,
              // findet „heute", ohne dass es ein zweites Kürzel dafür gäbe.
              .filter(
                (p) =>
                  !q ||
                  p.key.startsWith(q) ||
                  p.label.toLowerCase().startsWith(q),
              )
              .map((p) => ({
                id: p.id,
                label: p.label,
                hint: formatChipDate(p.id),
                icon: <Icon icon="lucide:calendar" width={16} />,
              })),
            {
              id: "calendar",
              label: t("dateOpenCalendar"),
              icon: <Icon icon="lucide:calendar-days" width={16} />,
            },
          ];
        },
        onSelect: ({ editor, range, item }) => {
          if (item.id === "calendar") {
            editor.chain().focus().deleteRange(range).run();
            openCalendar();
            return;
          }
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              { type: "dateChip", attrs: { date: item.id } },
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
        items: (query) => filterSlashItems(slashItems(t, openLink), query),
        onSelect: ({ editor, range, item }) => item.run({ editor, range }),
      }),
    });

    return [
      StarterKit.configure({
        // Eigene Erweiterungen — die Voreinstellungen des Kits würden sie sonst
        // doppelt registrieren.
        link: false,
        codeBlock: false,
      }),
      // Der Codeblock bekommt eine React-Ansicht: Sprachwahl und Kopierknopf
      // brauchen ein Menü, das `renderHTML` nicht liefern kann. Die
      // Hervorhebung selbst läuft über ProseMirror-Dekorationen — deshalb die
      // Lowlight-Variante statt des schlichten `CodeBlock`.
      CodeBlockLowlight.extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockView);
        },
      }).configure({ lowlight }),
      // Tiptaps `Link` baut den Anker selbst — der Titel muss deshalb hier
      // hinein, damit auch beim Schreiben zu sehen ist, wohin ein Wort führt.
      Link.extend({
        renderHTML({ HTMLAttributes }) {
          const href = HTMLAttributes.href;
          return [
            "a",
            mergeAttributes(HTMLAttributes, {
              ...(typeof href === "string" ? { title: href } : {}),
            }),
            0,
          ];
        },
      }).configure({ openOnClick: false, autolink: true }),
      Image,
      AttachmentNode.configure({ onRemove: onRemoveAttachment ?? null }),
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
      LinkChip,
      date,
      slash,
    ];
  }, [
    members,
    issues,
    placeholder,
    t,
    openCalendar,
    openLink,
    onRemoveAttachment,
  ]);

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
        const mod = event.metaKey || event.ctrlKey;

        if (event.key === "Enter" && mod) {
          event.preventDefault();
          onSubmit?.();
          return true;
        }

        // ⌘/Strg + K öffnet die Adresszeile — die verbreitete Belegung für
        // „Link". `stopPropagation`, damit die Tastenfolge nicht zusätzlich
        // bei einem übergeordneten Handler landet, solange hier geschrieben
        // wird.
        if ((event.key === "k" || event.key === "K") && mod) {
          event.preventDefault();
          event.stopPropagation();
          openLink();
          return true;
        }

        return false;
      },
      // Dateien aus Drag&Drop bzw. der Zwischenablage (z. B. ein eingefügter
      // Screenshot) laufen über denselben Upload-Pfad wie der
      // Werkzeugleisten-Knopf. Ohne `onUploadAttachment` bleibt das
      // Standardverhalten (Bild einfügen als Base64, Datei im Tab öffnen).
      handleDrop: (_view, event) => {
        if (!onUploadAttachment) return false;
        const file = event.dataTransfer?.files?.[0];
        if (!file) return false;
        event.preventDefault();
        pickAttachment(file);
        return true;
      },
      handlePaste: (_view, event) => {
        if (!onUploadAttachment) return false;
        const file = Array.from(event.clipboardData?.files ?? [])[0];
        if (!file) return false;
        event.preventDefault();
        pickAttachment(file);
        return true;
      },
    },
    // `toPlainDoc` ist Pflicht, nicht Vorsicht: ProseMirrors Attribute haben
    // keinen Prototyp und überleben den Weg zu einer Server Function nicht.
    onUpdate: ({ editor }) => onChange(toPlainDoc(editor.getJSON() as PMDoc)),
  });

  editorRef.current = editor;

  return (
    <div className={[styles.editor, className].filter(Boolean).join(" ")}>
      <EditorToolbar
        editor={editor}
        onLink={openLink}
        onAttachment={
          onUploadAttachment
            ? () => attachmentInputRef.current?.click()
            : undefined
        }
      />
      {onUploadAttachment && (
        <input
          ref={attachmentInputRef}
          type="file"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) pickAttachment(file);
          }}
        />
      )}
      {attachmentError && (
        <p className={styles.attachmentError} role="alert">
          {attachmentError}
        </p>
      )}
      {/* Der Ziehgriff ist kein fokussierbares Element: Ziehen nimmt dem Text
          den Fokus und gibt ihn an niemanden weiter. Danach zurückgeben, sonst
          steht der Cursor nach dem Vergrößern nicht mehr im Text.

          Die Abfrage auf `isFocused` ist wichtig — beim Markieren mit der Maus
          ist der Editor bereits fokussiert, und ein `focus()` würde die
          gerade gezogene Auswahl wieder einklappen. */}
      <EditorContent
        editor={editor}
        className={styles.content}
        onMouseUp={() => {
          if (editorRef.current && !editorRef.current.isFocused) {
            editorRef.current.commands.focus();
          }
        }}
      />

      {/* Am `body` statt im Editor: der scrollt, und ein Blatt darin würde
          mitgeschnitten. Die Koordinaten stammen vom Cursor. */}
      {calendar &&
        createPortal(
          <>
            {/* Ein Klick daneben schließt — ohne den Fokus aus dem Text zu ziehen. */}
            <button
              type="button"
              className={styles.floatingBackdrop}
              data-editor-floating
              aria-label={t("close")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={dismiss(() => setCalendar(null))}
            />
            <div
              className={styles.floatingLayer}
              data-editor-floating
              style={{ left: calendar.x, top: calendar.y }}
            >
              <Calendar
                onPick={insertDate}
                todayLabel={t("today")}
                tomorrowLabel={t("tomorrow")}
              />
            </div>
          </>,
          document.body,
        )}

      {linkAt &&
        createPortal(
          <>
            <button
              type="button"
              className={styles.floatingBackdrop}
              data-editor-floating
              aria-label={t("close")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={dismiss(() => setLinkAt(null))}
            />
            <div
              className={styles.floatingLayer}
              data-editor-floating
              style={{ left: linkAt.x, top: linkAt.y }}
            >
              <LinkForm
                initial={linkAt.initial}
                withName={linkAt.withName}
                onSubmit={applyLink}
                onRemove={linkAt.initial ? removeLink : undefined}
                onCancel={dismiss(() => setLinkAt(null))}
                label={t("link")}
                placeholder={t("linkPlaceholder")}
                nameLabel={t("linkName")}
                namePlaceholder={t("linkNamePlaceholder")}
                applyLabel={t("linkApply")}
                removeLabel={t("linkRemove")}
              />
            </div>
          </>,
          document.body,
        )}
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
 * Wo es eine Markdown-Eingaberegel gibt, steht sie als Hinweis rechts —
 * abgelesen aus den Erweiterungen, nicht geraten. Wer sie kennt, tippt
 * schneller als er das Menü öffnen kann; wer sie nicht kennt, lernt sie hier.
 *
 * - **Einfügen zuletzt.** Erwähnung und Issue haben mit `@` und `#` eigene
 *   Auslöser — hier stehen sie nur, damit man sie findet. Die drei
 *   Datumsangaben ganz ans Ende: sie belegen sonst drei Zeilen im Sichtfeld
 *   für etwas, das selten gebraucht wird.
 */
function slashItems(
  t: EditorTranslator,
  openLink: () => void,
): SlashCommandItem[] {
  /** Erst den `/…`-Text wegnehmen, dann den Befehl ausführen. */
  const at = (editor: Editor, range: { from: number; to: number }) =>
    editor.chain().focus().deleteRange(range);

  return [
    // ── Listen ───────────────────────────────────────────────────────────────
    {
      id: "bulletList",
      label: t("bulletList"),
      hint: "-",
      keywords: ["bullet list", "aufzählung", "liste", "list", "punkte", "ul"],
      group: t("groupLists"),
      icon: <Icon icon="lucide:list" width={16} />,
      run: ({ editor, range }) => at(editor, range).toggleBulletList().run(),
    },
    {
      id: "taskList",
      label: t("taskList"),
      hint: "[]",
      keywords: [
        "task list",
        "checkliste",
        "checklist",
        "todo",
        "aufgaben",
        "haken",
      ],
      group: t("groupLists"),
      icon: <Icon icon="lucide:list-checks" width={16} />,
      run: ({ editor, range }) => at(editor, range).toggleTaskList().run(),
    },
    {
      id: "orderedList",
      label: t("numberedList"),
      hint: "1.",
      keywords: [
        "numbered list",
        "nummerierte liste",
        "ordered list",
        "zahlen",
        "ol",
      ],
      group: t("groupLists"),
      icon: <Icon icon="lucide:list-ordered" width={16} />,
      run: ({ editor, range }) => at(editor, range).toggleOrderedList().run(),
    },

    // ── Text ─────────────────────────────────────────────────────────────────
    {
      id: "heading1",
      label: t("heading1"),
      hint: "#",
      keywords: ["heading 1", "überschrift 1", "titel", "title", "h1"],
      group: t("groupText"),
      icon: <Icon icon="lucide:heading-1" width={16} />,
      run: ({ editor, range }) =>
        at(editor, range).setNode("heading", { level: 1 }).run(),
    },
    {
      id: "heading2",
      label: t("heading2"),
      hint: "##",
      keywords: ["heading 2", "überschrift 2", "h2"],
      group: t("groupText"),
      icon: <Icon icon="lucide:heading-2" width={16} />,
      run: ({ editor, range }) =>
        at(editor, range).setNode("heading", { level: 2 }).run(),
    },
    {
      id: "heading3",
      label: t("heading3"),
      hint: "###",
      keywords: ["heading 3", "überschrift 3", "h3"],
      group: t("groupText"),
      icon: <Icon icon="lucide:heading-3" width={16} />,
      run: ({ editor, range }) =>
        at(editor, range).setNode("heading", { level: 3 }).run(),
    },

    // ── Blöcke ───────────────────────────────────────────────────────────────
    {
      id: "codeBlock",
      label: t("codeBlock"),
      hint: "```",
      keywords: ["code block", "codeblock", "quelltext", "snippet", "code"],
      group: t("groupBlocks"),
      icon: <Icon icon="lucide:code" width={16} />,
      run: ({ editor, range }) => at(editor, range).toggleCodeBlock().run(),
    },
    {
      id: "blockquote",
      label: t("quote"),
      hint: ">",
      keywords: ["quote", "zitat", "blockquote"],
      group: t("groupBlocks"),
      icon: <Icon icon="lucide:quote" width={16} />,
      run: ({ editor, range }) => at(editor, range).toggleBlockquote().run(),
    },
    {
      id: "infoPanel",
      label: t("infoPanel"),
      keywords: ["info panel", "infoblock", "hinweis", "info", "panel"],
      group: t("groupBlocks"),
      icon: <Icon icon="lucide:info" width={16} />,
      run: ({ editor, range }) => at(editor, range).togglePanel("info").run(),
    },
    {
      id: "warningPanel",
      label: t("warningPanel"),
      keywords: [
        "warning panel",
        "warnblock",
        "warnung",
        "achtung",
        "warning",
        "panel",
      ],
      group: t("groupBlocks"),
      icon: <Icon icon="lucide:triangle-alert" width={16} />,
      run: ({ editor, range }) =>
        at(editor, range).togglePanel("warning").run(),
    },
    {
      id: "table",
      label: t("table"),
      keywords: ["table", "tabelle", "raster"],
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
      hint: "---",
      keywords: [
        "divider",
        "trennlinie",
        "linie",
        "strich",
        "separator",
        "rule",
        "hr",
      ],
      group: t("groupBlocks"),
      icon: <Icon icon="lucide:minus" width={16} />,
      run: ({ editor, range }) => at(editor, range).setHorizontalRule().run(),
    },

    // ── Einfügen ─────────────────────────────────────────────────────────────
    {
      id: "link",
      label: t("link"),
      hint: `${modKey()} K`,
      keywords: [
        "link",
        "url",
        "website",
        "verlinkung",
        "adresse",
        "hyperlink",
      ],
      group: t("groupInsert"),
      icon: <Icon icon="lucide:link" width={16} />,
      // Erst den `/…`-Text wegnehmen, dann die Adresszeile öffnen — sie hängt
      // sich an die Stelle, an der der Cursor danach steht.
      run: ({ editor, range }) => {
        at(editor, range).run();
        openLink();
      },
    },
    {
      id: "mention",
      label: t("mention"),
      hint: "@",
      keywords: [
        "mention",
        "erwähnung",
        "erwähnen",
        "mitglied",
        "person",
        "user",
      ],
      group: t("groupInsert"),
      icon: <Icon icon="lucide:at-sign" width={16} />,
      // Den Trigger einfach schreiben — daraufhin geht dessen eigene Liste auf.
      run: ({ editor, range }) => at(editor, range).insertContent("@").run(),
    },
    {
      id: "issue",
      label: t("issueLink"),
      hint: "#",
      keywords: [
        "issue",
        "issue verlinken",
        "issue link",
        "ticket",
        "aufgabe",
        "link",
      ],
      group: t("groupInsert"),
      icon: <Icon icon="lucide:hash" width={16} />,
      run: ({ editor, range }) => at(editor, range).insertContent("#").run(),
    },
    {
      id: "date",
      label: t("date"),
      hint: "//",
      keywords: ["date", "datum", "kalender", "calendar", "termin", "frist"],
      group: t("groupInsert"),
      icon: <Icon icon="lucide:calendar" width={16} />,
      // Wie bei Erwähnung und Issue: den Auslöser schreiben und übergeben.
      run: ({ editor, range }) => at(editor, range).insertContent("//").run(),
    },
  ];
}
