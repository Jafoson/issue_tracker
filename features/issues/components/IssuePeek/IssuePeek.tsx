"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { IssueDetail } from "@/features/issues/components/IssueDetail/IssueDetail";
import type { IssueComposerData } from "@/features/issues/types";
import { DockPanel, useDock } from "@/lib/context";

/** Der URL-Parameter, an dem das Panel hängt: `?issue=PREFIX-123`. */
export const ISSUE_PARAM = "issue";

interface IssuePeekProps {
  data: IssueComposerData;
}

/**
 * Zeigt die Detailansicht als angedocktes Seitenpanel, sobald `?issue=` in der
 * URL steht — Liste, Board, Inbox und „Meine Aufgaben“ setzen den Parameter
 * beim Klick auf eine Zeile bzw. Karte.
 *
 * Die URL ist dabei die einzige Quelle: das Panel folgt ihr, und wer es
 * schließt (Escape, Kreuz), räumt den Parameter weg. So bleibt jedes offene
 * Issue verlinkbar, ohne dass Öffner und Panel je einen zweiten Zustand
 * pflegen müssten.
 *
 * Gerendert wird nicht hier, sondern im Dock der App-Hülle (`DockOutlet`) —
 * dort steht das Panel neben dem Inhalt statt über ihm, und der Inhalt wird
 * entsprechend schmaler. Der Weg dorthin ist ein Portal; die Contexts folgen
 * weiter dieser Stelle im React-Baum.
 */
export function IssuePeek({ data }: IssuePeekProps) {
  const searchParams = useSearchParams();
  const { node, setOverlay } = useDock();
  const issueRef = searchParams.get(ISSUE_PARAM);

  /**
   * Entfernt den Parameter, ohne die Route neu zu holen: die Server-Daten
   * hängen nicht daran, und ein Round-Trip nur fürs Schließen wäre spürbar.
   */
  const close = useCallback(() => {
    // Das nächste Panel fängt wieder an der Kante an, nicht ausgeklappt.
    setOverlay(false);
    const params = new URLSearchParams(window.location.search);
    params.delete(ISSUE_PARAM);
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}`,
    );
  }, [setOverlay]);

  // Beim Verlassen der Seite (z.B. „In Vollbild öffnen“) darf kein
  // ausgeklappter Zustand über der nächsten Route hängen bleiben.
  useEffect(() => () => setOverlay(false), [setOverlay]);

  if (!issueRef || !node) return null;

  return createPortal(
    <DockPanel label={issueRef} onClose={close}>
      <IssueDetail
        issueRef={issueRef}
        data={data}
        onClose={close}
        onSetExpanded={setOverlay}
      />
    </DockPanel>,
    node,
  );
}
