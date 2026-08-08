"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Hält den Benutzer auf der Seite, solange etwas Ungespeichertes offen ist.
 *
 * ```tsx
 * const confirm = useConfirm()
 * useUnsavedChanges(pending.size > 0, () =>
 *   confirm({ title: t("leaveTitle"), … }),
 * )
 * ```
 *
 * Drei Wege führen von einer Seite weg, und jeder verlangt seine eigene Bremse:
 *
 *   1. **Das Dokument verlassen** — neu laden, Tab schließen, fremde Adresse.
 *      Dafür gibt es nur `beforeunload`; der Text des Dialogs gehört dem
 *      Browser, `confirmLeave` kommt hier nicht zum Zug.
 *   2. **Ein Link in der Anwendung.** Der Klick wird in der Capture-Phase
 *      abgefangen, bevor der Router ihn sieht; erst nach einem Ja navigiert der
 *      Router selbst.
 *   3. **Zurück und Vorwärts.** Ein Rückwärtsschritt lässt sich nicht
 *      aufhalten, nur beantworten — deshalb liegt ab der ersten Änderung eine
 *      Kopie des aktuellen Eintrags auf dem Verlaufsstapel. Der erste
 *      Rückwärtsschritt verbraucht die Kopie und landet wieder hier; erst nach
 *      einem Ja geht es wirklich zurück.
 *
 * Die Kopie bleibt nach dem Speichern liegen — sie wieder abzuräumen hieße, den
 * Verlauf zu bewegen, und das ist von hier aus nicht sicher von einer echten
 * Navigation zu unterscheiden. Der Preis ist ein Rückwärtsschritt, der einmal
 * nichts tut; ihn zu sparen wäre den Preis nicht wert, versehentlich eine
 * fremde Navigation rückgängig zu machen.
 *
 * `confirmLeave` beantwortet „wirklich verlassen?" mit `true`/`false`. Die
 * ungespeicherten Änderungen selbst räumt der Aufrufer nicht auf: die Seite
 * verschwindet ohnehin, und beim nächsten Aufruf steht wieder der Stand des
 * Servers da.
 */
export function useUnsavedChanges(
  dirty: boolean,
  confirmLeave: () => Promise<boolean>,
) {
  const router = useRouter();

  // Die Listener hängen über die ganze Lebensdauer und lesen den Stand hier
  // heraus — sonst hinge an jeder einzelnen Änderung ein Ab- und Anmelden.
  const state = useRef({ dirty, confirmLeave });
  useEffect(() => {
    state.current = { dirty, confirmLeave };
  });

  // Gesetzt, während wir selbst den Verlauf bewegen (Punkt 3). Eine schon
  // beantwortete Frage darf nicht ein zweites Mal gestellt werden — weder von
  // uns noch vom Browser.
  const leaving = useRef(false);

  // ── 1. Das Dokument verlassen ──────────────────────────────────────────────
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (leaving.current) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // ── 2. Links in der Anwendung ──────────────────────────────────────────────
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!state.current.dirty) return;
      // Mittelklick, ⌘/Strg/Umschalt/Alt: der Browser öffnet dann einen neuen
      // Tab oder ein neues Fenster — diese Seite bleibt stehen.
      if (event.button !== 0 || event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, location.href);
      // Fremde Herkunft heißt: das Dokument wird verlassen, und dafür ist schon
      // `beforeunload` zuständig. Dieselbe Adresse ist keine Navigation.
      if (url.origin !== location.origin) return;
      if (url.href === location.href) return;

      event.preventDefault();
      // Auch die übrigen Zuhörer auf dem Dokument sollen den Klick nicht mehr
      // sehen: die Navigation ist abgesagt, nicht verschoben. Erst nach der
      // Antwort geht es weiter — und dann über den Router.
      event.stopImmediatePropagation();

      void state.current.confirmLeave().then((leave) => {
        if (leave) router.push(url.pathname + url.search + url.hash);
      });
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  // ── 3. Zurück und Vorwärts ─────────────────────────────────────────────────

  // Die Kopie wird einmal je Aufenthalt gelegt, nicht bei jedem Wechsel von
  // „sauber" zu „geändert" — sonst wüchse der Verlauf mit jedem Klick in der
  // Matrix um einen toten Eintrag.
  const copied = useRef(false);

  useEffect(() => {
    if (!dirty || copied.current) return;
    copied.current = true;
    history.pushState(history.state, "", location.href);
  }, [dirty]);

  useEffect(() => {
    const onPopState = () => {
      // Der Schritt kommt von uns selbst — die Frage ist längst beantwortet.
      if (leaving.current) {
        leaving.current = false;
        return;
      }
      if (!state.current.dirty) return;

      void state.current.confirmLeave().then((leave) => {
        // Die Kopie ist mit dem Rückwärtsschritt verbraucht: entweder geht es
        // jetzt eine Stelle weiter zurück — dort liegt die Seite, die der
        // Benutzer wollte — oder eine neue Kopie tritt an ihre Stelle.
        if (leave) {
          leaving.current = true;
          history.back();
        } else {
          history.pushState(history.state, "", location.href);
        }
      });
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
}
