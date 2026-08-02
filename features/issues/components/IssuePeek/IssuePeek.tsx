"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import { IssueDetail } from "@/features/issues/components/IssueDetail/IssueDetail";
import { closeIssuePanel, ISSUE_PARAM } from "@/features/issues/issue-links";
import type { IssueComposerData } from "@/features/issues/types";
import { DockPanel, useDock } from "@/lib/context";
import { useSessionFlag } from "@/lib/utils/useSessionFlag";

/**
 * Ob die Detailansicht zuletzt als großer Dialog stand statt als Seitenpanel.
 *
 * Wer einmal umschaltet, meint in aller Regel nicht nur dieses eine Issue —
 * also gilt die Wahl bis zum Ende der Sitzung, auch über den Wechsel zwischen
 * Liste, Board und Posteingang hinweg (dabei wird diese Komponente jedes Mal
 * neu montiert). Beim nächsten Besuch fängt es wieder am Rand an.
 */
const EXPANDED_KEY = "issue-detail-expanded";

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
  const t = useTranslations();
  const searchParams = useSearchParams();
  const { node } = useDock();
  const [isExpanded, setExpanded] = useSessionFlag(EXPANDED_KEY);
  const issueRef = searchParams.get(ISSUE_PARAM);

  if (!issueRef || !node) return null;

  return createPortal(
    // Ausgeklappt hebt sich das Panel selbst über die Seite — Hülle und Inhalt
    // lesen denselben Wert, es gibt also keinen Moment, in dem das eine schon
    // umgestellt ist und das andere noch nicht.
    <DockPanel
      label={issueRef}
      overlay={isExpanded}
      closeLabel={t("actions.close")}
      onClose={closeIssuePanel}
    >
      <IssueDetail
        issueRef={issueRef}
        data={data}
        onClose={closeIssuePanel}
        isExpanded={isExpanded}
        onToggleExpanded={() => setExpanded(!isExpanded)}
      />
    </DockPanel>,
    node,
  );
}
