import { AppearanceListener } from "./AppearanceListener";

interface Props {
  /** `"system"` folgt der Einstellung des Betriebssystems. */
  theme: "dark" | "light" | "system";
}

/**
 * Trägt das Design an das Dokument, bevor der Inhalt zu sehen ist.
 *
 * Das Wurzel-Layout schreibt die Vorgabe (`data-theme="dark"`) fest ins HTML —
 * es rendert auch die Anmeldeseite und soll dafür nicht die Datenbank fragen
 * müssen. Wessen Wahl davon abweicht, bekommt sie hier: als kurzes Skript ganz
 * oben im Rumpf, das noch während des Ladens läuft. Ein `useEffect` täte es erst
 * nach dem ersten Bild — die Seite blitzte dann sichtbar dunkel auf, bevor sie
 * hell wird.
 *
 * Für `"system"` steht die Antwort nur im Browser: der Server weiß nicht, wie
 * das Gerät eingestellt ist. Das Skript liest sie beim Start, und
 * `AppearanceListener` bleibt danach an der Medienabfrage — wer sein System
 * abends auf dunkel stellt, soll nicht neu laden müssen.
 */
export function Appearance({ theme }: Props) {
  // Der Wert kommt aus der Datenbank und wird hier zu Code — deshalb durch
  // JSON.stringify statt in die Zeichenkette eingesetzt.
  const script = `(function(){try{var r=document.documentElement,t=${JSON.stringify(theme)};r.dataset.theme=t==="system"?(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):t;}catch(e){}})();`;

  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: eigener, aus
          festen Werten gebauter Code — anders lässt sich kein Skript einbetten,
          das vor dem ersten Bild läuft. */}
      <script dangerouslySetInnerHTML={{ __html: script }} />
      {theme === "system" && <AppearanceListener />}
    </>
  );
}
