import type { useTranslations } from "next-intl";

// Type of the translation function returned by useTranslations() (root namespace).
// For helpers/components that receive the function as a parameter/prop.
// `<never>` forces the root namespace so dotted-path keys (e.g.
// "actions.newIssue") are accepted.
export type Translator = ReturnType<typeof useTranslations<never>>;
