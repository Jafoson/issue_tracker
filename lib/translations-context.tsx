"use client";

import { useParams } from "next/navigation";
import { createContext, useContext } from "react";
import type { StaticMessages } from "@/lib/i18n";

const fns = {
  en: {
    members: {
      activeProjects: (n: number) => `${n} active project${n !== 1 ? "s" : ""}`,
    },
    empty: { noResults: (q: string) => `No results for "${q}"` },
    login: { signInTo: (ws: string) => `Sign in to ${ws}` },
    filters: {
      statuses: (n: number) => `${n} status${n !== 1 ? "es" : ""}`,
      priorities: (n: number) => `${n} priorit${n !== 1 ? "ies" : "y"}`,
      people: (n: number) => `${n} ${n !== 1 ? "people" : "person"}`,
      labels: (n: number) => `${n} label${n !== 1 ? "s" : ""}`,
    },
  },
  de: {
    members: {
      activeProjects: (n: number) =>
        `${n} aktive${n !== 1 ? " Projekte" : "s Projekt"}`,
    },
    empty: { noResults: (q: string) => `Keine Ergebnisse für „${q}"` },
    login: { signInTo: (ws: string) => `Bei ${ws} anmelden` },
    filters: {
      statuses: (n: number) => `${n} Status`,
      priorities: (n: number) => `${n} Priorität${n !== 1 ? "en" : ""}`,
      people: (n: number) => `${n} Person${n !== 1 ? "en" : ""}`,
      labels: (n: number) => `${n} Label${n !== 1 ? "s" : ""}`,
    },
  },
};

type LocaleFns = typeof fns.en;

export type T = Omit<StaticMessages, "members" | "empty" | "login"> & {
  members: StaticMessages["members"] & LocaleFns["members"];
  empty: StaticMessages["empty"] & LocaleFns["empty"];
  login: StaticMessages["login"] & LocaleFns["login"];
  filters: LocaleFns["filters"];
};

const Ctx = createContext<T | null>(null);

export function useTranslations(): T {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error("useTranslations must be used within TranslationsProvider");
  return ctx;
}

export function TranslationsProvider({
  children,
  messages,
}: {
  children: React.ReactNode;
  messages: StaticMessages;
}) {
  const { locale } = useParams<{ locale: string }>();
  const f = fns[locale as keyof typeof fns] ?? fns.en;

  const t: T = {
    ...messages,
    members: { ...messages.members, ...f.members },
    empty: { ...messages.empty, ...f.empty },
    login: { ...messages.login, ...f.login },
    filters: f.filters,
  };

  return <Ctx.Provider value={t}>{children}</Ctx.Provider>;
}
