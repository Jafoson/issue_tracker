"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { getProjectsForWorkspaces } from "@/features/workspaces/actions";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { Project } from "@/types";
import { type TabMeta, tabMeta, workspaceIdFromPath } from "./tabMeta";

type StoredTab = { id: string; href: string };
export type Tab = StoredTab & { meta: TabMeta };

// Ein einziger, globaler Tab-Set über alle Bereiche (Workspaces + Admin).
// Die Tabs speichern jeweils die volle URL, der Kontext wird daraus abgeleitet.
const TABS_KEY = "orbit-tabs";
const ACTIVE_KEY = "orbit-active";

function load(fallback: string): { tabs: StoredTab[]; activeId: string } {
  try {
    const raw = localStorage.getItem(TABS_KEY);
    const rawActive = localStorage.getItem(ACTIVE_KEY);
    if (raw) {
      const tabs = JSON.parse(raw) as StoredTab[];
      if (Array.isArray(tabs) && tabs.length > 0) {
        const activeId =
          rawActive && tabs.some((t) => t.id === rawActive)
            ? rawActive
            : tabs[0].id;
        return { tabs, activeId };
      }
    }
  } catch {}
  const id = crypto.randomUUID();
  return { tabs: [{ id, href: fallback }], activeId: id };
}

function save(tabs: StoredTab[]) {
  localStorage.setItem(TABS_KEY, JSON.stringify(tabs));
}

interface UseTabBarOptions {
  // Href des ersten Tabs bzw. neu geöffneter Tabs.
  defaultHref: string;
  // Serverseitig vorgeladene Projekte des aktiven Workspace — Startwert für den
  // Projekt-Cache unten, damit dessen Tab sofort korrekt betitelt ist.
  projects: Project[];
  // ID des aktiven Workspace, oder `null` im Admin-Bereich.
  currentWorkspaceId: string | null;
}

// Hält den gesamten Tab-Zustand: Persistenz (localStorage), Navigation und die
// Auflösung von Titel/Farbe/Icon pro Tab. Jeder Tab trägt seine eigene
// Workspace-ID in der URL — Projekte fremder Workspaces sind serverseitig
// nicht vorgeladen und werden hier gezielt nachgeladen, sobald ein
// entsprechender Tab auftaucht. TabBarClient bekommt bereits fertige,
// renderbare Tabs zurück und bleibt reine Darstellung.
export function useTabBar({
  defaultHref,
  projects,
  currentWorkspaceId,
}: UseTabBarOptions) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Full URL of the current view including the query string (filters, sort…).
  // usePathname() alone drops the query, which would lose per-tab filter state.
  const qs = searchParams.toString();
  const currentHref = qs ? `${pathname}?${qs}` : pathname;

  const [rawTabs, setRawTabs] = useState<StoredTab[]>([]);
  const [activeId, setActiveId] = useState("");
  const [ready, setReady] = useState(false);

  // Set right before switchTab/openTab/closeTab trigger their own navigation —
  // their target tab's href is already correct, so the tracking effect below
  // should skip that one run instead of overwriting it with the stale href.
  const justSwitchedRef = useRef(false);

  const [projectsByWorkspace, setProjectsByWorkspace] = useState<
    Record<string, Project[]>
  >(() => (currentWorkspaceId ? { [currentWorkspaceId]: projects } : {}));

  // Welche Workspace-IDs schon geladen (oder angefragt) sind — verhindert
  // wiederholte Server-Aufrufe für dieselbe Workspace bei jedem Tab-Wechsel.
  const requestedRef = useRef(
    new Set<string>(currentWorkspaceId ? [currentWorkspaceId] : []),
  );

  useEffect(() => {
    const s = load(defaultHref);
    setRawTabs(s.tabs);
    setActiveId(s.activeId);
    setReady(true);
  }, [defaultHref]);

  // Keep the active tab in sync with reality whenever the URL changes for a
  // reason the tab bar didn't initiate itself — an in-tab navigation (sidebar
  // link, filters), the browser back/forward buttons, a typed/bookmarked URL,
  // or a remount after crossing between the admin and workspace shells (they're
  // separate layouts, so e.g. /my → /admin loses in-memory state and reloads
  // from localStorage, which may still point at the old URL). If an existing
  // tab already matches the new URL, that one becomes active; otherwise the
  // currently active tab is updated to it, same as an in-tab navigation would.
  useEffect(() => {
    if (!ready || !activeId) return;

    if (justSwitchedRef.current) {
      justSwitchedRef.current = false;
      return;
    }

    if (rawTabs.some((tab) => tab.id === activeId && tab.href === currentHref))
      return;

    const matching = rawTabs.find((tab) => tab.href === currentHref);
    if (matching) {
      setActiveId(matching.id);
      return;
    }

    const next = rawTabs.map((tab) =>
      tab.id === activeId ? { ...tab, href: currentHref } : tab,
    );
    save(next);
    setRawTabs(next);
  }, [currentHref, activeId, ready, rawTabs]);

  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
  }, [activeId]);

  // Projekte für Workspaces nachladen, die noch keiner offene Tab bereits kennt
  // (z.B. ein Tab, der in einem anderen Workspace geöffnet wurde).
  useEffect(() => {
    const missing = [
      ...new Set(
        rawTabs
          .map((tab) => workspaceIdFromPath(tab.href))
          .filter(
            (id): id is string => id !== null && !requestedRef.current.has(id),
          ),
      ),
    ];
    if (missing.length === 0) return;

    for (const id of missing) requestedRef.current.add(id);

    getProjectsForWorkspaces(missing).then((byWorkspace) => {
      setProjectsByWorkspace((prev) => ({ ...prev, ...byWorkspace }));
    });
  }, [rawTabs]);

  function switchTab(id: string) {
    const tab = rawTabs.find((t) => t.id === id);
    if (!tab || id === activeId) return;
    justSwitchedRef.current = true;
    setActiveId(id);
    router.push(tab.href);
  }

  function openTab() {
    const id = crypto.randomUUID();
    const tab = { id, href: defaultHref };
    const next = [...rawTabs, tab];
    save(next);
    setRawTabs(next);
    justSwitchedRef.current = true;
    setActiveId(id);
    router.push(defaultHref);
  }

  function closeTab(id: string) {
    if (rawTabs.length <= 1) return;
    const idx = rawTabs.findIndex((t) => t.id === id);
    const next = rawTabs.filter((t) => t.id !== id);
    save(next);
    setRawTabs(next);
    if (id === activeId) {
      const target = next[Math.max(0, idx - 1)];
      justSwitchedRef.current = true;
      setActiveId(target.id);
      router.push(target.href);
    }
  }

  const tabs: Tab[] = rawTabs.map((tab) => {
    const workspaceId = workspaceIdFromPath(tab.href);
    const tabProjects = workspaceId
      ? (projectsByWorkspace[workspaceId] ?? [])
      : [];
    return { ...tab, meta: tabMeta(tab.href, tabProjects, t) };
  });

  return { tabs, activeId, ready, switchTab, openTab, closeTab };
}
