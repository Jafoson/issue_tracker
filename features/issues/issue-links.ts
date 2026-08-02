"use client";

import { useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { getPathname, usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/** Der URL-Parameter, an dem das Seitenpanel hängt: `?issue=PREFIX-123`. */
export const ISSUE_PARAM = "issue";

/** Kanonischer Pfad der Vollseite eines Issues, ohne Locale-Präfix. */
export const issuePath = (workspaceId: string, identifier: string) =>
  `/${workspaceId}/issue/${identifier}`;

/**
 * Räumt `?issue=` aus der URL — mehr braucht es nicht, das Panel hängt allein
 * daran.
 *
 * Bewusst ohne Router: die Server-Daten der Ansicht hängen nicht an dem
 * Parameter, und ein Round-Trip nur fürs Schließen wäre spürbar. Next hält
 * `useSearchParams` an `history.replaceState` synchron, die Ansicht merkt es
 * also trotzdem — Panel zu, Zeile bzw. Karte wieder unmarkiert.
 *
 * Steht hier und nicht in der Komponente, weil es zwei Wege zu schließen gibt:
 * das Kreuz am Panel und der zweite Klick auf dieselbe Zeile. Beide sollen
 * dasselbe tun, nicht nur ungefähr.
 */
export function closeIssuePanel() {
  const params = new URLSearchParams(window.location.search);
  params.delete(ISSUE_PARAM);
  const query = params.toString();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}`,
  );
}

/**
 * Ob der Browser diesen Klick selbst behandeln soll: Strg/Cmd (neuer Tab),
 * Shift (neues Fenster), Alt (Ziel sichern) oder eine andere Taste als die
 * linke. Dieselbe Prüfung, die auch `next/link` seinem eigenen Router
 * voranstellt — was der Browser besser kann, soll er behalten.
 */
export function isBrowserClick(event: React.MouseEvent): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

/**
 * Die beiden Wege, ein Issue zu öffnen — aus Liste, Board, Posteingang und
 * „Meine Aufgaben“ gleichermaßen.
 *
 * Der gewöhnliche Klick legt das Panel über die Ansicht, in der man gerade
 * steht (`?issue=` in der URL, mehr braucht es nicht). Strg/Cmd- und
 * Mittelklick meinen etwas anderes: sie wollen das Issue nebenher, ohne die
 * Liste zu verlassen — dafür ist die Vollseite da, und der neue Tab ist die
 * Antwort, die der Browser seit jeher darauf gibt.
 */
export function useIssueOpen(workspaceId: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = useLocale() as Locale;

  /** Das Issue, das gerade im Panel steht — `null`, solange keines offen ist. */
  const openIssue = searchParams.get(ISSUE_PARAM);

  /**
   * Panel über der aktuellen Ansicht — die Filter der Liste bleiben stehen.
   *
   * Auf dieselbe Zeile ein zweites Mal zu klicken schließt es wieder. Das
   * Panel zeigt dann ja schon, was der Klick verlangt; ihn ins Leere laufen zu
   * lassen, wäre die einzige Alternative — und der Weg zum Kreuz am anderen
   * Ende des Fensters die Folge.
   */
  const openPanel = (identifier: string) => {
    if (identifier === openIssue) {
      closeIssuePanel();
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set(ISSUE_PARAM, identifier);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  /**
   * Vollseite in einem neuen Tab. Der Pfad wird hier lokalisiert: `window.open`
   * kennt die Routing-Regeln von next-intl nicht.
   */
  const openPageInNewTab = (identifier: string) => {
    const href = getPathname({
      href: issuePath(workspaceId, identifier),
      locale,
    });
    window.open(href, "_blank", "noopener,noreferrer");
  };

  /**
   * Props für eine Zeile, die ohnehin ein Link ist.
   *
   * Das `href` zeigt auf die Vollseite, nicht auf `?issue=` — so öffnen
   * Strg-Klick, Mittelklick und „Link in neuem Tab öffnen“ aus dem
   * Kontextmenü alle dasselbe, ohne dass wir eine Taste abfragen müssten.
   * Abgefangen wird nur der schlichte Linksklick; der bekommt das Panel.
   */
  const linkProps = (identifier: string) => ({
    href: issuePath(workspaceId, identifier),
    // Ohne Prefetch: die Seite ist dynamisch, und eine Liste mit hundert
    // Zeilen würde sie hundertmal anfordern für einen Klick, der meist im
    // Panel endet.
    prefetch: false,
    onClick: (event: React.MouseEvent) => {
      if (isBrowserClick(event)) return;
      event.preventDefault();
      openPanel(identifier);
    },
  });

  return { linkProps, openIssue, openPanel, openPageInNewTab };
}
