"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type Tab = {
  id: string;
  href: string;
};

function storageKey(ws: string) {
  return `orbit-tabs-${ws}`;
}
function activeKey(ws: string) {
  return `orbit-active-${ws}`;
}

function load(ws: string, fallback: string): { tabs: Tab[]; activeId: string } {
  try {
    const raw = localStorage.getItem(storageKey(ws));
    const rawActive = localStorage.getItem(activeKey(ws));
    if (raw) {
      const tabs = JSON.parse(raw) as Tab[];
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

function save(ws: string, tabs: Tab[]) {
  localStorage.setItem(storageKey(ws), JSON.stringify(tabs));
}

export function useTabBar(workspace: string, defaultHref: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Full URL of the current view including the query string (filters, sort…).
  // usePathname() alone drops the query, which would lose per-tab filter state.
  const qs = searchParams.toString();
  const currentHref = qs ? `${pathname}?${qs}` : pathname;

  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeId, setActiveId] = useState("");
  const [ready, setReady] = useState(false);

  // Tracks the activeId from the last effect run to detect tab switches.
  // When activeId changes (tab switch) we skip the href update — the new tab's
  // href is already correct. Only a plain pathname change (user navigated within
  // the current tab) should update the stored href.
  const prevActiveIdRef = useRef("");

  useEffect(() => {
    const s = load(workspace, defaultHref);
    setTabs(s.tabs);
    setActiveId(s.activeId);
    setReady(true);
  }, [workspace, defaultHref]);

  // Track navigation within the current tab — including the query string, so
  // each tab keeps its own filters/sort even after switching away and back.
  useEffect(() => {
    if (!ready || !activeId) return;

    const activeIdChanged = activeId !== prevActiveIdRef.current;
    prevActiveIdRef.current = activeId;

    // Skip when activeId just changed — this effect fired because the tab
    // switched, not because the user navigated. The new tab's href is already
    // stored correctly. Updating here would overwrite it with the old href.
    if (activeIdChanged) return;

    setTabs((prev) => {
      const next = prev.map((t) =>
        t.id === activeId ? { ...t, href: currentHref } : t,
      );
      save(workspace, next);
      return next;
    });
  }, [currentHref, activeId, ready, workspace]);

  useEffect(() => {
    if (activeId) localStorage.setItem(activeKey(workspace), activeId);
  }, [activeId, workspace]);

  function switchTab(id: string) {
    const tab = tabs.find((t) => t.id === id);
    if (!tab || id === activeId) return;
    setActiveId(id);
    router.push(tab.href);
  }

  function openTab() {
    const id = crypto.randomUUID();
    const tab = { id, href: defaultHref };
    const next = [...tabs, tab];
    save(workspace, next);
    setTabs(next);
    setActiveId(id);
    router.push(defaultHref);
  }

  function closeTab(id: string) {
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex((t) => t.id === id);
    const next = tabs.filter((t) => t.id !== id);
    save(workspace, next);
    setTabs(next);
    if (id === activeId) {
      const target = next[Math.max(0, idx - 1)];
      setActiveId(target.id);
      router.push(target.href);
    }
  }

  return { tabs, activeId, ready, switchTab, openTab, closeTab };
}
