"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname, useParams } from "next/navigation";
import { UIProvider } from "@/lib/ui-store";
import { WorkspaceProvider } from "@/lib/workspace-context";
import { TranslationsProvider } from "@/lib/translations-context";
import { Sidebar } from "@/components/ui/layout/Sidebar/Sidebar";
import { Topbar } from "@/components/ui/layout/Topbar/Topbar";
import { IssueDetail } from "@/features/issues/components/IssueDetail/IssueDetail";
import { IssueComposer } from "@/features/issues/components/IssueComposer/IssueComposer";
import { CommandPalette } from "@/features/issues/components/CommandPalette/CommandPalette";
import { useUI } from "@/lib/ui-store";
import { logout } from "@/features/auth/actions";
import type { WorkspaceData } from "@/lib/workspace-context";
import type { StaticMessages } from "@/lib/i18n";
import styles from "./appShell.module.scss";

function Toast() {
  const { ui } = useUI();
  if (!ui.toast) return null;
  return (
    <div className={styles.toasts}>
      <div className="orbit-toast">{ui.toast.msg}</div>
    </div>
  );
}

function Shell({ children, workspace }: { children: React.ReactNode; workspace: WorkspaceData }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useParams<{ locale: string }>();
  const [composerOpen, setComposerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen]   = useState(false);

  async function handleLogout() {
    await logout();
    router.push(`/${locale}/login`);
  }

  const issueId = searchParams.get("issue");

  useEffect(() => {
    (window as { __openComposer?: () => void }).__openComposer = () => setComposerOpen(true);
    (window as { __openPalette?:  () => void }).__openPalette  = () => setPaletteOpen(true);
    return () => {
      delete (window as { __openComposer?: () => void }).__openComposer;
      delete (window as { __openPalette?:  () => void }).__openPalette;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setPaletteOpen((o) => !o); }
      if ((e.metaKey || e.ctrlKey) && e.key === "i") { e.preventDefault(); setComposerOpen(true); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={styles.shell}>
      <Sidebar onLogout={handleLogout} loggedIn={true} />
      <div className={styles.main}>
        <Topbar />
        <div className={styles.content}>{children}</div>
      </div>
      {issueId && <IssueDetail id={issueId} onClose={() => router.back()} />}
      <IssueComposer open={composerOpen} onClose={() => setComposerOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <Toast />
    </div>
  );
}

export function AppShell({ children, workspace, messages }: { children: React.ReactNode; workspace: WorkspaceData; messages: StaticMessages }) {
  return (
    <UIProvider>
      <TranslationsProvider messages={messages}>
        <WorkspaceProvider value={workspace}>
          <Suspense fallback={null}>
            <Shell workspace={workspace}>{children}</Shell>
          </Suspense>
        </WorkspaceProvider>
      </TranslationsProvider>
    </UIProvider>
  );
}
