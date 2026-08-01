"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { IssueDetail } from "@/features/issues/components/IssueDetail/IssueDetail";
import type { IssueComposerData } from "@/features/issues/types";
import { useModal } from "@/lib/context";

/** Der URL-Parameter, an dem das Panel hängt: `?issue=PREFIX-123`. */
export const ISSUE_PARAM = "issue";

interface IssuePeekProps {
  data: IssueComposerData;
}

/**
 * Öffnet die Detailansicht als Seitenpanel, sobald `?issue=` in der URL steht —
 * Liste, Board, Inbox und „Meine Aufgaben“ setzen den Parameter beim Klick auf
 * eine Zeile bzw. Karte.
 *
 * Die URL ist dabei die einzige Quelle: das Panel folgt ihr, und wer es
 * schließt (Escape, Backdrop, X), räumt über `onClose` den Parameter weg. So
 * bleibt jedes offene Issue verlinkbar, ohne dass Öffner und Panel je einen
 * zweiten Zustand pflegen müssten.
 *
 * Gerendert wird nichts — das Panel liegt im Modal-Stack (`ModalOutlet`).
 */
export function IssuePeek({ data }: IssuePeekProps) {
  const searchParams = useSearchParams();
  const { openModal, closeModal } = useModal();
  const issueRef = searchParams.get(ISSUE_PARAM);
  const opened = useRef<{ ref: string; id: string } | null>(null);

  /**
   * Entfernt den Parameter, ohne die Route neu zu holen: die Server-Daten
   * hängen nicht daran, und ein Round-Trip nur fürs Schließen wäre spürbar.
   * Der Vergleich verhindert, dass ein spät schließendes Panel den Parameter
   * eines inzwischen anderen Issues abräumt.
   */
  const clearParam = useCallback((ref: string) => {
    const params = new URLSearchParams(window.location.search);
    if (params.get(ISSUE_PARAM) !== ref) return;
    params.delete(ISSUE_PARAM);
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}`,
    );
  }, []);

  useEffect(() => {
    const current = opened.current;
    if (current?.ref === issueRef) return;

    // Wechsel auf ein anderes Issue: das alte Panel geht still, sein Parameter
    // ist ohnehin schon überschrieben.
    if (current) {
      opened.current = null;
      closeModal(current.id, { silent: true });
    }
    if (!issueRef) return;

    const id = openModal(
      ({ close, setOptions }) => (
        <IssueDetail
          issueRef={issueRef}
          data={data}
          onClose={close}
          onSetModalOptions={setOptions}
        />
      ),
      {
        placement: "right",
        label: issueRef,
        onClose: () => {
          opened.current = null;
          clearParam(issueRef);
        },
      },
    );
    opened.current = { ref: issueRef, id };
  }, [issueRef, data, openModal, closeModal, clearParam]);

  // Beim Verlassen der Seite (z.B. „In Vollbild öffnen“) darf kein Panel über
  // der nächsten Route stehen bleiben.
  useEffect(
    () => () => {
      if (!opened.current) return;
      closeModal(opened.current.id, { silent: true });
      opened.current = null;
    },
    [closeModal],
  );

  return null;
}
