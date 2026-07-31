import type { PMDoc, PMNode } from "./types";

/**
 * Ein leeres Dokument. ProseMirror verlangt mindestens einen Absatz — ein `doc`
 * ganz ohne Inhalt lässt sich zwar speichern, aber der Editor ersetzt es beim
 * Laden ohnehin sofort. Deshalb hier gleich die kanonische Form.
 */
export const EMPTY_DOC: PMDoc = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

/** Frische Kopie — sonst teilen sich alle Aufrufer dasselbe Objekt. */
export function emptyDoc(): PMDoc {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

/**
 * Erkennt Dokumente, die zwar Knoten enthalten, aber nichts anzuzeigen haben:
 * ein einzelner leerer Absatz sieht in der Datenbank nicht leer aus, für den
 * Leser ist er es aber. Entscheidet, ob der Platzhalter erscheint.
 */
export function isEmptyDoc(doc: PMDoc | null | undefined): boolean {
  if (!doc?.content?.length) return true;
  return doc.content.every(isEmptyNode);
}

function isEmptyNode(node: PMNode): boolean {
  // Atome tragen ihren Inhalt in den Attributen, nicht in `content` — ein
  // einzelnes Bild oder ein Datums-Chip ist kein leeres Dokument.
  if (node.type !== "paragraph") return false;
  if (!node.content?.length) return true;
  return node.content.every((child) => child.type === "text" && !child.text);
}

/**
 * Prüft eingehendes JSON, bevor es gerendert oder gespeichert wird. Die Spalte
 * ist `Json` — Prisma gibt zurück, was drinsteht, und das muss nicht unbedingt
 * ein Dokument sein (alte Zeile, fehlgeschlagene Migration, manueller Eingriff).
 */
export function isPMDoc(value: unknown): value is PMDoc {
  if (typeof value !== "object" || value === null) return false;
  const doc = value as PMDoc;
  if (doc.type !== "doc") return false;
  return doc.content === undefined || Array.isArray(doc.content);
}

/**
 * Der Weg von der Datenbank in die Anwendung: alles, was kein gültiges Dokument
 * ist, wird zum leeren Dokument. Lieber eine leere Beschreibung als eine Seite,
 * die am kaputten Datensatz eines einzelnen Issues zerbricht.
 */
export function toDoc(value: unknown): PMDoc {
  return isPMDoc(value) ? value : emptyDoc();
}

/**
 * Der Weg aus dem Editor heraus: macht aus dem Dokument ein gewöhnliches Objekt.
 *
 * ProseMirror legt die Attribute eines Knotens mit `Object.create(null)` an
 * (`computeAttrs` in prosemirror-model), und `Node.toJSON()` reicht genau dieses
 * Objekt weiter — ohne Prototyp. React weigert sich, so etwas an eine Server
 * Function zu übergeben: `isSimpleObject` verlangt `Object.prototype` in der
 * Kette, findet `null` und schiebt statt der Daten eine temporäre Referenz
 * hinüber. Auf dem Server bricht dann jeder Zugriff darauf ab —
 * „Cannot access label on the server."
 *
 * Betroffen ist jeder Knoten mit Attributen: Erwähnung, Issue, Datum, Emoji,
 * Überschrift (`level`), Codeblock (`language`), Panel (`kind`),
 * Checklisten-Eintrag (`checked`), nummerierte Liste (`start`). Ohne diesen
 * Umlauf käme davon nichts heil in der Datenbank an.
 *
 * Der Weg über JSON ist hier nicht faul, sondern genau richtig: das Dokument
 * *ist* JSON, und `JSON.parse` liefert garantiert Objekte mit gewöhnlichem
 * Prototyp.
 */
export function toPlainDoc(doc: PMDoc): PMDoc {
  return JSON.parse(JSON.stringify(doc));
}
