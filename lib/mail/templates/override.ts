/**
 * Der admin-editierbare Teil einer Vorlage — Betreff, Überschrift und
 * Einleitungstext, mit `{{platzhalter}}`-Syntax. Alles andere (Layout,
 * Detailtabellen, Knopf) bleibt Sache der jeweiligen Vorlagenfunktion.
 */
export interface TemplateOverride {
  subject: string;
  heading: string;
  bodyText: string;
}

/**
 * Ersetzt `{{name}}` durch `values.name` — ein unbekannter oder falsch
 * geschriebener Platzhalter bleibt wörtlich stehen, statt eine leere Stelle
 * oder einen Fehler zu erzeugen. So bricht ein Tippfehler im Admin-Editor
 * nie den Versand, nur die Ausgabe an genau dieser Stelle bleibt auffällig.
 */
export function applyPlaceholders(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    Object.hasOwn(values, key) ? values[key] : match,
  );
}

/**
 * Klartext für einen der drei editierbaren Bausteine — der Admin-Override,
 * platzhalter-ersetzt, wenn er für dieses Feld gesetzt ist, sonst der
 * Code-Default. Beide Pfade liefern reinen Text; das HTML entsteht erst beim
 * Aufrufer per `escapeHtml()`, damit Default und Override exakt gleich
 * gerendert werden und nicht zwei verschiedene Formatierungswege pflegen.
 *
 * Ein leeres Feld zählt als „nicht gesetzt“, nicht als Wunsch nach leerem
 * Text — sonst würde das Ausfüllen nur eines Felds im Admin-Editor die beiden
 * anderen (noch unausgefüllten) auf leer ziehen, statt bei deren Default zu
 * bleiben. Einen wirklich leeren Betreff verschicken zu wollen ist ohnehin
 * kein Fall, den diese Vorlagen abdecken müssen.
 */
export function resolveText(
  defaultValue: string,
  overrideTemplate: string | undefined,
  placeholders: Record<string, string>,
): string {
  return overrideTemplate
    ? applyPlaceholders(overrideTemplate, placeholders)
    : defaultValue;
}
