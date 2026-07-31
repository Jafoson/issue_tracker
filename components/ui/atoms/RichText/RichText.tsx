import type { CSSProperties, ReactNode } from "react";
import { Chip } from "@/components/ui/atoms/Chip/Chip";
import { formatChipDate } from "@/lib/richtext/date";
import { toDoc } from "@/lib/richtext/doc";
import { faviconOf, hostOf } from "@/lib/richtext/link";
import type { PMDoc, PMMark, PMNode } from "@/lib/richtext/types";
import styles from "./richText.module.scss";

/**
 * Zeigt ein ProseMirror-Dokument an — ohne ProseMirror.
 *
 * Der Editor ist schwer und läuft nur im Browser; gelesen wird ein Issue aber
 * viel öfter als geschrieben. Deshalb übersetzt diese Komponente das gespeicherte
 * JSON von Hand nach React: keine Abhängigkeit, kein `generateHTML`, vor allem
 * kein `dangerouslySetInnerHTML` — fremder Text landet niemals als HTML im
 * Dokument. Adressen laufen durch `safeUrl`, damit `javascript:`-Links gar nicht
 * erst entstehen.
 *
 * Keine Client-Direktive: rendert in Server Components.
 *
 * Wer hier einen Knotentyp ergänzt, muss die passende Extension im
 * `RichTextEditor` mitliefern — und umgekehrt.
 */

/** Nur Adressen, die im Browser harmlos sind — alles andere bleibt Text. */
function safeUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  return /^(?:https?:\/\/|mailto:|\/|#)/i.test(url) ? url : null;
}

function attr(node: PMNode, key: string): string {
  const value = node.attrs?.[key];
  return typeof value === "string" ? value : "";
}

/**
 * Legt die Auszeichnungen um einen Textknoten. Von innen nach außen, damit die
 * Reihenfolge im Baum der im Editor entspricht.
 */
function applyMarks(
  content: ReactNode,
  marks: PMMark[],
  key: string,
): ReactNode {
  return marks.reduce<ReactNode>((inner, mark, index) => {
    const markKey = `${key}m${index}`;
    switch (mark.type) {
      case "bold":
        return <strong key={markKey}>{inner}</strong>;
      case "italic":
        return <em key={markKey}>{inner}</em>;
      case "strike":
        return <del key={markKey}>{inner}</del>;
      case "code":
        return <code key={markKey}>{inner}</code>;
      case "link": {
        const href = safeUrl(mark.attrs?.href);
        if (!href) return inner;
        return (
          <a
            key={markKey}
            href={href}
            // Beim Überfahren steht die Adresse da — im Fließtext sieht man
            // dem Wort sonst nicht an, wohin es führt.
            title={href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {inner}
          </a>
        );
      }
      default:
        return inner;
    }
  }, content);
}

function renderAll(
  nodes: PMNode[] | undefined,
  keyPrefix: string,
): ReactNode[] {
  return (nodes ?? []).map((node, index) =>
    renderNode(node, `${keyPrefix}.${index}`),
  );
}

function renderNode(node: PMNode, key: string): ReactNode {
  const children = () => renderAll(node.content, key);

  switch (node.type) {
    case "text":
      return applyMarks(node.text ?? "", node.marks ?? [], key);

    case "paragraph":
      return <p key={key}>{children()}</p>;

    case "heading": {
      const raw = node.attrs?.level;
      const level = typeof raw === "number" ? Math.min(Math.max(raw, 1), 6) : 1;
      const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      return <Tag key={key}>{children()}</Tag>;
    }

    case "bulletList":
      return <ul key={key}>{children()}</ul>;

    case "orderedList": {
      const start = node.attrs?.start;
      return (
        <ol key={key} start={typeof start === "number" ? start : undefined}>
          {children()}
        </ol>
      );
    }

    case "listItem":
      return <li key={key}>{children()}</li>;

    case "taskList":
      return (
        <ul key={key} className={styles.taskList}>
          {children()}
        </ul>
      );

    case "taskItem": {
      const checked = node.attrs?.checked === true;
      return (
        <li key={key} className={styles.taskItem} data-checked={checked}>
          {/* Nur Anzeige — abgehakt wird im Editor, nicht im gelesenen Text. */}
          <input type="checkbox" checked={checked} disabled readOnly />
          <div>{children()}</div>
        </li>
      );
    }

    case "blockquote":
      return <blockquote key={key}>{children()}</blockquote>;

    case "codeBlock":
      return (
        <pre key={key}>
          <code data-language={attr(node, "language") || undefined}>
            {children()}
          </code>
        </pre>
      );

    case "horizontalRule":
      return <hr key={key} />;

    case "hardBreak":
      return <br key={key} />;

    case "image": {
      const src = safeUrl(node.attrs?.src);
      if (!src) return null;
      // biome-ignore lint/performance/noImgElement: fremde Adresse, kein bekanntes Format und keine bekannten Maße — `next/image` kann hier nichts optimieren
      return <img key={key} src={src} alt={attr(node, "alt")} />;
    }

    case "table":
      return (
        // Breite Tabellen scrollen in ihrem Block, statt das Panel zu dehnen.
        <div key={key} className={styles.tableWrap}>
          <table>
            <tbody>{children()}</tbody>
          </table>
        </div>
      );

    case "tableRow":
      return <tr key={key}>{children()}</tr>;

    case "tableHeader":
    case "tableCell": {
      const Tag = node.type === "tableHeader" ? "th" : "td";
      const span = (name: string) => {
        const value = node.attrs?.[name];
        return typeof value === "number" && value > 1 ? value : undefined;
      };
      return (
        <Tag key={key} colSpan={span("colspan")} rowSpan={span("rowspan")}>
          {children()}
        </Tag>
      );
    }

    case "panel":
      return (
        <aside
          key={key}
          className={styles.panel}
          data-kind={attr(node, "kind") || "info"}
        >
          {children()}
        </aside>
      );

    case "mention":
      // Das `@` gehört in den Text, nicht in einen eigenen Slot: so sitzt es
      // von selbst auf der Grundlinie und wird beim Markieren mitkopiert.
      return (
        <Chip key={key} as="span" size="inline" variant="elevated" data-mention>
          @{attr(node, "label")}
        </Chip>
      );

    case "issueLink": {
      const identifier = attr(node, "identifier");
      if (!identifier) return null;
      // Dieselbe Adresse, über die Board, Inbox und Palette ein Issue öffnen:
      // ein `issue`-Parameter an der aktuellen Route. Der Chip liegt im Link
      // statt selbst einer zu sein — `Chip` kennt nur `div` und `span`.
      return (
        <a
          key={key}
          className={styles.chipLink}
          href={`?issue=${encodeURIComponent(identifier)}`}
        >
          <Chip
            as="span"
            size="inline"
            variant="elevated"
            className={styles.chipHover}
            icon={<span className={styles.issueIcon} aria-hidden="true" />}
          >
            <span className={styles.issueLinkLabel}>{identifier}</span>
          </Chip>
        </a>
      );
    }

    case "linkChip": {
      const href = safeUrl(node.attrs?.href);
      if (!href) return null;
      const label = attr(node, "label") || hostOf(href);
      const favicon = faviconOf(href);
      // Wie beim Issue: der Chip liegt im Link, statt selbst einer zu sein —
      // `Chip` kennt nur `div` und `span`.
      return (
        <a
          key={key}
          className={styles.chipLink}
          href={href}
          title={href}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Chip
            as="span"
            size="inline"
            variant="elevated"
            className={styles.chipHover}
            icon={
              <span
                className={styles.linkIcon}
                // Das Favicon liegt als Hintergrund darüber; lädt es nicht,
                // bleibt das Kettenglied darunter stehen.
                style={
                  favicon
                    ? ({ "--favicon": `url("${favicon}")` } as CSSProperties)
                    : undefined
                }
                aria-hidden="true"
              />
            }
          >
            {label}
          </Chip>
        </a>
      );
    }

    case "dateChip": {
      const iso = attr(node, "date");
      return (
        <Chip
          key={key}
          as="span"
          size="inline"
          variant="elevated"
          icon={<span className={styles.dateIcon} aria-hidden="true" />}
          // Der maschinenlesbare Wert gehört an ein `<time>`; der Chip ist
          // nur die Hülle darum.
          title={iso}
          // Die Schreibweise richtet sich nach der Umgebung, und die ist auf
          // dem Server eine andere als im Browser. Der maschinenlesbare Wert
          // steht unverändert im `datetime`-Attribut.
        >
          <time dateTime={iso} suppressHydrationWarning>
            {formatChipDate(iso)}
          </time>
        </Chip>
      );
    }

    case "emoji":
      return (
        <span key={key} role="img" aria-label={attr(node, "name")}>
          {attr(node, "emoji")}
        </span>
      );

    // Unbekannter Knoten (älteres Dokument, neuere Extension): der Inhalt soll
    // trotzdem lesbar bleiben, nur ohne seine Hülle.
    default:
      return node.content?.length ? <div key={key}>{children()}</div> : null;
  }
}

interface RichTextProps {
  /** Das gespeicherte Dokument — ungeprüftes JSON aus der Datenbank ist erlaubt. */
  value: PMDoc | unknown;
  className?: string;
}

export function RichText({ value, className }: RichTextProps) {
  const doc = toDoc(value);
  return (
    <div className={[styles.richText, className].filter(Boolean).join(" ")}>
      {renderAll(doc.content, "n")}
    </div>
  );
}
