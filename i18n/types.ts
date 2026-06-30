import type { useTranslations } from "next-intl";

// Typ der von useTranslations() (Root-Namespace) gelieferten Übersetzungsfunktion.
// Für Helper/Komponenten, die die Funktion als Parameter/Prop erhalten.
// `<never>` erzwingt den Root-Namespace, damit Punkt-Pfad-Keys (z. B.
// "actions.newIssue") akzeptiert werden.
export type Translator = ReturnType<typeof useTranslations<never>>;
