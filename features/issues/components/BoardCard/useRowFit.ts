"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** Die natürlichen Breiten einer Reihe: die der Kinder und die des Zählers. */
interface Widths {
  items: number[];
  more: number;
}

/**
 * Wie viele Kinder der Reihe nebeneinander stehen können, wenn am Ende noch der
 * Zähler für den Rest Platz finden soll.
 */
function fitCount(row: HTMLElement, widths: Widths) {
  const gap = Number.parseFloat(getComputedStyle(row).columnGap) || 0;
  // Ein halber Pixel Nachsicht: Breiten kommen gebrochen zurück, und an einer
  // Rundung soll kein Label scheitern.
  const room = row.getBoundingClientRect().width + 0.5;
  const upTo = (k: number) =>
    k > 0
      ? widths.items.slice(0, k).reduce((sum, w) => sum + w, 0) + gap * (k - 1)
      : 0;

  let n = widths.items.length;
  while (n > 0 && upTo(n) > room) n--;
  // Bleibt etwas übrig, will auch der Zähler stehen — notfalls weicht ein
  // weiteres Label für ihn.
  if (n < widths.items.length) {
    while (n > 0 && upTo(n) + gap + widths.more > room) n--;
  }
  return n;
}

/**
 * Kürzt eine Reihe auf eine Zeile und sagt, wie viele Kinder davon übrig
 * bleiben — den Rest fasst der Aufrufer als "+n" zusammen.
 *
 * CSS kann die Reihe abschneiden (`overflow`), aber nicht zählen, was es
 * abgeschnitten hat: es gibt keinen Selektor für "ragt heraus". Also wird
 * gemessen — dieselbe Ausnahme wie in `useTextEnd`, und mit demselben Zuschnitt:
 * hier fällt nur eine Zahl an, gestaltet wird weiterhin im Stylesheet.
 *
 * Gemessen wird genau einmal je Satz Labels, im Durchgang bevor gekürzt ist —
 * danach steht die Hälfte gar nicht mehr im DOM. Die Breiten bleiben deshalb
 * gemerkt: wird die Spalte schmaler, rechnet der Beobachter allein damit weiter,
 * ohne die Reihe erst wieder vollständig aufbauen zu müssen.
 *
 * ```tsx
 * const { ref, fit } = useRowFit(labels.length, labels.map((l) => l.name).join())
 * const shown = fit === null ? labels : labels.slice(0, fit)
 * ```
 *
 * Solange `fit` `null` ist, läuft der Messdurchgang: dann gehören *alle* Kinder
 * in die Reihe und der Zähler als letztes, aus dem Fluss genommen. Dieser
 * Zustand ist zugleich der vor der Hydration und der ohne JavaScript — die Reihe
 * bricht deshalb auch ungekürzt nicht um, sondern wird beschnitten.
 */
export function useRowFit(
  /** Anzahl der Kinder vor dem Zähler. */
  count: number,
  /** Ändert er sich, stimmen die gemerkten Breiten nicht mehr. */
  key: string,
) {
  // Das Element als Zustand, nicht als Ref: nur so merkt der Effekt, dass eine
  // neue Reihe gerendert wurde, und misst die statt der weggeworfenen.
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [state, setState] = useState<{ key: string; fit: number | null }>({
    key,
    fit: null,
  });
  const widths = useRef<Widths | null>(null);

  // Neue Labels heißt: erst wieder alles zeigen, dann messen. Das steht bewusst
  // hier und nicht in einem Effekt — ein Effekt käme eine Runde zu spät und
  // fände die schon gekürzte Reihe vor.
  const fit = state.key === key ? state.fit : null;

  useLayoutEffect(() => {
    if (!element) return;

    const children = Array.from(element.children);
    const all = children.map((child) => child.getBoundingClientRect().width);
    // Der Zähler steht hinter den Kindern und hängt außerhalb des Flusses.
    widths.current = { items: all.slice(0, count), more: all[count] ?? 0 };
    setState({ key, fit: fitCount(element, widths.current) });
  }, [element, key, count]);

  useLayoutEffect(() => {
    if (!element) return;

    // Wird die Spalte schmaler, passen weniger Labels nebeneinander.
    const observer = new ResizeObserver(() => {
      if (widths.current) {
        setState({ key, fit: fitCount(element, widths.current) });
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, key]);

  return { ref: setElement, fit };
}
