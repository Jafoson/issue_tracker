import "server-only";

const loaders = {
  en: () => import("../messages/en.json").then((m) => m.default),
  de: () => import("../messages/de.json").then((m) => m.default),
};

export type Locale = keyof typeof loaders;

export const hasLocale = (locale: string): locale is Locale => locale in loaders;

export async function getStaticMessages(locale: Locale) {
  return loaders[locale]();
}

export type StaticMessages = Awaited<ReturnType<typeof getStaticMessages>>;
