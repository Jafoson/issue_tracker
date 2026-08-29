/**
 * The admin-editable part of a template — subject, heading, and intro text,
 * using `{{placeholder}}` syntax. Everything else (layout, detail tables,
 * button) stays the responsibility of the respective template function.
 */
export interface TemplateOverride {
  subject: string;
  heading: string;
  bodyText: string;
}

/**
 * Replaces `{{name}}` with `values.name` — an unknown or misspelled
 * placeholder is left as-is, rather than producing an empty spot or an
 * error. This way a typo in the admin editor never breaks sending; only the
 * output at that exact spot stays noticeably wrong.
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
 * Plain text for one of the three editable building blocks — the admin
 * override, placeholder-substituted, if it's set for this field, otherwise
 * the code default. Both paths return plain text; the HTML is only produced
 * by the caller via `escapeHtml()`, so the default and the override render
 * exactly the same way instead of maintaining two different formatting
 * paths.
 *
 * An empty field counts as "not set", not as a request for empty text —
 * otherwise filling in just one field in the admin editor would blank out
 * the other two (still unfilled) instead of leaving them at their default.
 * Wanting to actually send a truly empty subject isn't a case these
 * templates need to cover anyway.
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
