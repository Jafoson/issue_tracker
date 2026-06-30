"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Sidebar } from "@/components/ui/layout/Sidebar/Sidebar";
import { Topbar } from "@/components/ui/layout/Topbar/Topbar";
import { logout } from "@/features/auth/actions";
import { CommandPalette } from "@/features/issues/components/CommandPalette/CommandPalette";
import { IssueComposer } from "@/features/issues/components/IssueComposer/IssueComposer";
import { IssueDetail } from "@/features/issues/components/IssueDetail/IssueDetail";
import { useRouter } from "@/i18n/navigation";
import { UIProvider, useUI } from "@/lib/ui-store";
import type { WorkspaceData } from "@/lib/workspace-context";
import { WorkspaceProvider } from "@/lib/workspace-context";
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

function Shell({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerStatus, setComposerStatus] = useState<string | undefined>(
    undefined,
  );
  const [paletteOpen, setPaletteOpen] = useState(false);

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  const issueRef = searchParams.get("issue");

  useEffect(() => {
    (window as { __openComposer?: (status?: string) => void }).__openComposer =
      (status?: string) => {
        setComposerStatus(status);
        setComposerOpen(true);
      };
    (window as { __openPalette?: () => void }).__openPalette = () =>
      setPaletteOpen(true);
    return () => {
      delete (window as { __openComposer?: (status?: string) => void })
        .__openComposer;
      delete (window as { __openPalette?: () => void }).__openPalette;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "i") {
        e.preventDefault();
        setComposerStatus(undefined);
        setComposerOpen(true);
      }
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
      {issueRef && <IssueDetail id={issueRef} onClose={() => router.back()} />}
      <IssueComposer
        open={composerOpen}
        initialStatus={composerStatus}
        onClose={() => setComposerOpen(false)}
      />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
      <Toast />
    </div>
  );
}

export function AppShell({
  children,
  workspace,
}: {
  children: React.ReactNode;
  workspace: WorkspaceData;
}) {
  return (
    <UIProvider>
      <WorkspaceProvider value={workspace}>
        <Suspense fallback={null}>
          <Shell>{children}</Shell>
        </Suspense>
      </WorkspaceProvider>
    </UIProvider>
  );
}
