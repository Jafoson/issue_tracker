"use client";

import type { DragEvent, KeyboardEvent } from "react";
import { useRef, useState } from "react";
import { FLAT_GROUP_ID, type TableGroup } from "./types";

/**
 * Wohin eine gezogene Zeile fallen gelassen wurde.
 *
 * Bewusst nicht als "neuer Index in der Gesamtliste": die Nachbarn sind das,
 * woraus ein Aufrufer mit Rangspalte seinen neuen Rang bildet (Mitte zwischen
 * beiden), und `groupId` sagt ihm, welches Feld die Gruppe abbildet.
 */
export interface TableDrop<T> {
  row: T;
  /** Zielgruppe — bei einer Tabelle ohne Gruppen immer `"rows"`. */
  groupId: string;
  /** Einfügeposition in der Zielgruppe, die gezogene Zeile herausgerechnet. */
  index: number;
  /** Die künftigen Nachbarn der Zeile; `null` am Anfang bzw. Ende der Gruppe. */
  previous: T | null;
  next: T | null;
}

export type TableDndPhase = "grabbed" | "moved" | "dropped" | "cancelled";

/** Bausteine einer Ansage — den Satz formuliert der Aufrufer, er hat die Sprache. */
export interface TableDndAnnouncement<T> {
  row: T;
  groupId: string;
  /** Zählt ab 1 — die Zahl geht so, wie sie ist, an Menschen. */
  position: number;
  total: number;
  phase: TableDndPhase;
}

export interface TableDndOptions<T> {
  getRowKey: (row: T) => string;
  /**
   * Meldet die neue Position. Das Wegschreiben (und das optimistische
   * Umsortieren) gehört dem Aufrufer — die Tabelle besitzt die Daten nicht.
   */
  onDrop: (target: TableDrop<T>) => void;
  /** Dieselben Zeilen wie an `Table` — flach oder in Gruppen. */
  rows?: T[];
  groups?: TableGroup<T>[];
  /** Zeilen, die liegen bleiben sollen. Ohne Angabe ist jede Zeile ziehbar. */
  canDrag?: (row: T) => boolean;
  /** Benennt die Zeile am Griff, z. B. "ABC-12 Login schlägt fehl verschieben". */
  rowLabel?: (row: T) => string;
  /** Formuliert die Ansage; ohne sie bleibt die Live-Region stumm. */
  announce?: (announcement: TableDndAnnouncement<T>) => string;
}

/** Was `Table` an ein `<tr>` hängt. */
export interface TableRowDnd {
  draggable: boolean;
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent) => void;
  "data-dragging"?: true;
  "data-drop"?: "above" | "below";
}

/** Was `Table` an den Griff der Zeile hängt. */
export interface TableHandleDnd {
  "aria-label"?: string;
  "aria-pressed": boolean;
  "data-grabbed"?: true;
  onKeyDown: (event: KeyboardEvent) => void;
  onBlur: () => void;
}

export interface TableGroupDnd {
  onDragOver: (event: DragEvent) => void;
  "data-drop"?: "below";
}

export interface TableRootDnd {
  onDragOver: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
  onDragLeave: (event: DragEvent) => void;
}

/** Was `<Table dnd={…}>` erwartet. Erzeugt wird es allein von `useTableDnd`. */
export interface TableDnd<T> {
  row: (row: T, groupId: string) => TableRowDnd;
  /** `null`, wenn die Zeile nicht ziehbar ist — dann bleibt die Gasse leer. */
  handle: (row: T, groupId: string) => TableHandleDnd | null;
  groupHeader: (groupId: string) => TableGroupDnd;
  root: TableRootDnd;
  /** Text der Live-Region; leer, solange nichts angesagt wurde. */
  status: string;
}

/** Einfügestelle: Gruppe plus Position *ohne* die gezogene Zeile. */
interface Slot {
  groupId: string;
  index: number;
}

interface Dragged<T> {
  row: T;
  key: string;
  groupId: string;
  /** Ausgangsposition — daran erkennt der Abwurf, ob sich überhaupt etwas ändert. */
  index: number;
}

const between = (value: number, max: number) =>
  Math.min(Math.max(value, 0), max);

/**
 * Sortieren per Drag & Drop für `Table` — Maus und Tastatur.
 *
 * Die Rechnung ist überall dieselbe: eine Einfügestelle ist eine Gruppe plus
 * ein Index in deren Zeilen *ohne* die gezogene. So gibt es keine Sonderfälle
 * für "eins nach unten" (wo die eigene Lücke den Index verschiebt), die Linie
 * lässt sich direkt daraus zeichnen, und beim Abwurf stehen die neuen Nachbarn
 * ohne weitere Umrechnung da.
 *
 * ```tsx
 * const dnd = useTableDnd<Issue>({
 *   groups,
 *   getRowKey: (issue) => issue.id,
 *   onDrop: ({ row, groupId, previous, next }) =>
 *     move(row, groupId, rankBetween(previous, next)),
 * })
 *
 * <Table groups={groups} getRowKey={(i) => i.id} dnd={dnd} … />
 * ```
 */
export function useTableDnd<T>(options: TableDndOptions<T>): TableDnd<T> {
  const { getRowKey, onDrop, canDrag, rowLabel, announce } = options;

  // Flache Zeilen sind auch hier die Gruppe "alle Zeilen" — dieselbe Lesart wie
  // in `Table`, damit die gemeldete `groupId` zu dem passt, was dort steht.
  const sections: TableGroup<T>[] = options.groups ?? [
    { id: FLAT_GROUP_ID, rows: options.rows ?? [] },
  ];

  const [dragKey, setDragKey] = useState<string | null>(null);
  const [grabbed, setGrabbed] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [status, setStatus] = useState("");

  // Der Abwurf liest, was das letzte `dragover` gesetzt hat — dafür ist der
  // gerenderte Zustand womöglich noch nicht durch. Refs sind immer aktuell.
  const dragRef = useRef<Dragged<T> | null>(null);
  const slotRef = useRef<Slot | null>(null);
  const grabbedRef = useRef(false);

  const moveSlot = (next: Slot | null) => {
    slotRef.current = next;
    setSlot(next);
  };

  const sectionOf = (groupId: string) => sections.find((s) => s.id === groupId);

  /** Die Zeilen einer Gruppe ohne die gezogene — der Bezug jeder Einfügestelle. */
  const restOf = (groupId: string, key: string | null) =>
    (sectionOf(groupId)?.rows ?? []).filter((row) => getRowKey(row) !== key);

  const locate = (key: string) => {
    for (const section of sections) {
      const index = section.rows.findIndex((row) => getRowKey(row) === key);
      if (index !== -1) return { groupId: section.id, index };
    }
    return null;
  };

  const say = (phase: TableDndPhase, target: Slot | null) => {
    const dragged = dragRef.current;
    if (!announce || !dragged) return;
    const at = target ?? { groupId: dragged.groupId, index: dragged.index };
    setStatus(
      announce({
        row: dragged.row,
        groupId: at.groupId,
        position: at.index + 1,
        total: restOf(at.groupId, dragged.key).length + 1,
        phase,
      }),
    );
  };

  const reset = () => {
    dragRef.current = null;
    slotRef.current = null;
    grabbedRef.current = false;
    setDragKey(null);
    setGrabbed(false);
    setSlot(null);
  };

  const pickUp = (row: T, groupId: string) => {
    const key = getRowKey(row);
    const index = locate(key)?.index ?? 0;
    dragRef.current = { row, key, groupId, index };
    setDragKey(key);
    moveSlot({ groupId, index });
  };

  const drop = () => {
    const dragged = dragRef.current;
    const target = slotRef.current;
    if (dragged && target) {
      const rest = restOf(target.groupId, dragged.key);
      const index = between(target.index, rest.length);
      // Zurück an dieselbe Stelle ist keine Änderung — den Aufrufer damit zu
      // behelligen hieße, ihn eine Serveraktion für nichts auslösen zu lassen.
      if (target.groupId !== dragged.groupId || index !== dragged.index) {
        onDrop({
          row: dragged.row,
          groupId: target.groupId,
          index,
          previous: rest[index - 1] ?? null,
          next: rest[index] ?? null,
        });
      }
      say("dropped", { groupId: target.groupId, index });
    }
    reset();
  };

  const cancel = () => {
    say("cancelled", null);
    reset();
  };

  /**
   * Alle Einfügestellen von oben nach unten — der Weg, den die Pfeiltasten
   * abschreiten. Eingeklappte Gruppen bekommen genau eine: sichtbare Zeilen
   * gibt es dort nicht, erreichbar bleibt die Gruppe trotzdem.
   */
  const slots = (key: string): Slot[] =>
    sections.flatMap((section) => {
      const last = section.collapsed ? 0 : restOf(section.id, key).length;
      return Array.from({ length: last + 1 }, (_, index) => ({
        groupId: section.id,
        index,
      }));
    });

  const step = (direction: 1 | -1) => {
    const dragged = dragRef.current;
    const current = slotRef.current;
    if (!dragged || !current) return;
    const all = slots(dragged.key);
    const at = all.findIndex(
      (candidate) =>
        candidate.groupId === current.groupId &&
        candidate.index === current.index,
    );
    if (at === -1) return;
    const next = all[between(at + direction, all.length - 1)];
    // Am Anfang und am Ende der Liste läuft der Weg aus — dort bleibt es beim
    // bisherigen Platz, statt still an die andere Seite zu springen.
    if (!next || next === all[at]) return;
    moveSlot(next);
    say("moved", next);
  };

  /** Seite, an der die Einfügelinie an dieser Zeile sitzt. */
  const edge = (row: T, groupId: string) => {
    if (!slot || !dragKey || slot.groupId !== groupId) return undefined;
    const rest = restOf(groupId, dragKey);
    if (rest.length === 0) return undefined;
    const key = getRowKey(row);
    // Hinter der letzten Zeile gibt es keine Zeile mehr, über der die Linie
    // liegen könnte — dann hängt sie unter der letzten.
    if (slot.index >= rest.length)
      return getRowKey(rest[rest.length - 1]) === key ? "below" : undefined;
    return getRowKey(rest[slot.index]) === key ? "above" : undefined;
  };

  const draggable = (row: T) => canDrag?.(row) ?? true;

  return {
    row: (row, groupId) => {
      const key = getRowKey(row);
      return {
        draggable: draggable(row),
        onDragStart: (event) => {
          event.dataTransfer.effectAllowed = "move";
          // Ohne Nutzlast startet Firefox keinen Zug. Ein eigener Typ statt
          // `text/plain`, damit die Zeile nicht in fremden Eingabefeldern landet.
          event.dataTransfer.setData("application/x-table-row", key);
          pickUp(row, groupId);
        },
        onDragEnd: reset,
        onDragOver: (event) => {
          const dragged = dragRef.current;
          // Nichts von uns unterwegs: Finger weg, sonst nähme die Tabelle
          // fremden Zügen (Dateien, Text) das Abwurfverbot.
          if (!dragged) return;
          event.preventDefault();
          // Die Zeile ist genauer als die Gruppe darunter — deren Handler darf
          // das Ergebnis nicht überschreiben.
          event.stopPropagation();
          const rest = restOf(groupId, dragged.key);
          const index = rest.findIndex((other) => getRowKey(other) === key);
          if (index === -1) return; // die gezogene Zeile selbst
          const box = event.currentTarget.getBoundingClientRect();
          const above = event.clientY < box.top + box.height / 2;
          moveSlot({ groupId, index: above ? index : index + 1 });
        },
        "data-dragging": dragKey === key || undefined,
        "data-drop": edge(row, groupId),
      };
    },

    handle: (row, groupId) => {
      if (!draggable(row)) return null;
      const key = getRowKey(row);
      const isGrabbed = grabbed && dragKey === key;
      return {
        "aria-label": rowLabel?.(row),
        "aria-pressed": isGrabbed,
        "data-grabbed": isGrabbed || undefined,
        onKeyDown: (event) => {
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            if (isGrabbed) {
              drop();
              return;
            }
            pickUp(row, groupId);
            grabbedRef.current = true;
            setGrabbed(true);
            say("grabbed", null);
            return;
          }
          if (!isGrabbed) return;
          if (event.key === "Escape") {
            event.preventDefault();
            cancel();
            return;
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            // Erst ab hier — ohne aufgenommene Zeile bleiben die Pfeiltasten
            // beim Scrollen.
            event.preventDefault();
            step(event.key === "ArrowDown" ? 1 : -1);
          }
        },
        // Wandert der Fokus weg, ist die Zeile nicht mehr zu steuern. Sie in der
        // Schwebe zu lassen wäre ein Zustand, den niemand mehr auflösen kann.
        onBlur: () => {
          if (grabbedRef.current) cancel();
        },
      };
    },

    groupHeader: (groupId) => ({
      onDragOver: (event) => {
        if (!dragRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        moveSlot({ groupId, index: 0 });
      },
      // Die Linie unter dem Kopf ist der einzige Anhalt, solange die Gruppe
      // keine sichtbare Zeile hat.
      "data-drop":
        slot?.groupId === groupId &&
        dragKey &&
        (sectionOf(groupId)?.collapsed || restOf(groupId, dragKey).length === 0)
          ? "below"
          : undefined,
    }),

    root: {
      // Fängt alles, was zwischen den Zeilen liegt — ohne ein `preventDefault`
      // hier verbietet der Browser dort den Abwurf.
      onDragOver: (event) => {
        if (dragRef.current) event.preventDefault();
      },
      onDrop: (event) => {
        if (!dragRef.current) return;
        event.preventDefault();
        drop();
      },
      onDragLeave: (event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        moveSlot(null);
      },
    },

    status,
  };
}
