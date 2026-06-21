"use client";

import { Icon } from "@iconify/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { StatusIcon } from "@/features/issues/components/IssueIcons/IssueIcons";
import type { T } from "@/lib/translations-context";
import { useTranslations } from "@/lib/translations-context";
import { useWorkspace } from "@/lib/workspace-context";
import styles from "./commandPalette.module.scss";

interface NavEntry {
  href: string;
  label: (t: T) => string;
  icon: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { searchIssues, projects } = useWorkspace();
  const t = useTranslations();
  const router = useRouter();
  const { locale, workspace } = useParams<{
    locale: string;
    workspace: string;
  }>();
  const base = `/${locale}/w/${workspace}`;
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const NAV_ENTRIES: NavEntry[] = [
    {
      href: `${base}/my`,
      icon: "lucide:user",
      label: (t) => t.palette.goto.my,
    },
    {
      href: `${base}/inbox`,
      icon: "lucide:inbox",
      label: (t) => t.palette.goto.inbox,
    },
    {
      href: `${base}/members`,
      icon: "lucide:users",
      label: (t) => t.palette.goto.members,
    },
    {
      href: `${base}/teams`,
      icon: "lucide:users-2",
      label: (t) => t.palette.goto.teams,
    },
    {
      href: `${base}/settings`,
      icon: "lucide:settings",
      label: (t) => t.palette.goto.settings,
    },
  ];

  useEffect(() => {
    if (open) {
      setQ("");
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const lq = q.toLowerCase();

  const navHits = NAV_ENTRIES.filter((e) =>
    e.label(t).toLowerCase().includes(lq),
  );
  const boardHits = projects
    .filter((p) => p.name.toLowerCase().includes(lq) || "board".includes(lq))
    .map((p) => ({
      href: `${base}/board/${p.id}`,
      label: () => p.name,
      icon: "lucide:layout-dashboard",
    }));

  const allNavHits = [...navHits, ...boardHits];

  const issueHits = searchIssues
    .filter((i) => {
      const prefix = projects.find((p) => p.id === i.project)?.prefix ?? "?";
      const identifier = `${prefix}-${i.key}`;
      return (
        i.title.toLowerCase().includes(lq) ||
        identifier.toLowerCase().includes(lq)
      );
    })
    .slice(0, 6);

  type ResultItem =
    | { kind: "nav"; href: string; label: string; icon: string }
    | {
        kind: "issue";
        id: string;
        title: string;
        status: string;
        identifier: string;
      };

  const results: ResultItem[] = [
    ...allNavHits.map((e) => ({
      kind: "nav" as const,
      href: e.href,
      label: e.label(t),
      icon: e.icon,
    })),
    ...issueHits.map((i) => ({
      kind: "issue" as const,
      id: i.id,
      title: i.title,
      status: i.status,
      identifier: `${projects.find((p) => p.id === i.project)?.prefix ?? "?"}-${i.key}`,
    })),
  ];

  const select = (item: ResultItem) => {
    if (item.kind === "nav") {
      router.push(item.href);
    } else {
      router.push(`?issue=${item.identifier}`, { scroll: false });
    }
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <div className="orbit-overlay">
      <button
        type="button"
        className="orbit-backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="orbit-cmd">
        <div className={styles.inputWrap}>
          <Icon icon="lucide:search" width={16} className="faint" />
          <input
            ref={inputRef}
            className={styles.input}
            placeholder={t.placeholders.searchIssues}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, results.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              }
              if (e.key === "Enter" && results[cursor]) select(results[cursor]);
              if (e.key === "Escape") onClose();
            }}
          />
          <span className="kbd">ESC</span>
        </div>

        <div className={styles.results}>
          {results.length === 0 && (
            <div className={styles.empty}>{t.empty.noResults(q)}</div>
          )}
          {allNavHits.length > 0 && (
            <>
              <div className={styles.groupLabel}>{t.palette.navigation}</div>
              {allNavHits.map((e, idx) => (
                <button
                  type="button"
                  key={e.href}
                  className={`${styles.row}${idx === cursor ? ` ${styles.active}` : ""}`}
                  onMouseEnter={() => setCursor(idx)}
                  onClick={() =>
                    select({
                      kind: "nav",
                      href: e.href,
                      label: e.label(t),
                      icon: e.icon,
                    })
                  }
                >
                  <Icon icon={e.icon} width={15} />
                  <span>{e.label(t)}</span>
                </button>
              ))}
            </>
          )}
          {issueHits.length > 0 && (
            <>
              <div className={styles.groupLabel}>{t.palette.issues}</div>
              {issueHits.map((i, idx) => {
                const absIdx = allNavHits.length + idx;
                const identifier = `${projects.find((p) => p.id === i.project)?.prefix ?? "?"}-${i.key}`;
                return (
                  <button
                    type="button"
                    key={i.id}
                    className={`${styles.row}${absIdx === cursor ? ` ${styles.active}` : ""}`}
                    onMouseEnter={() => setCursor(absIdx)}
                    onClick={() =>
                      select({
                        kind: "issue",
                        id: i.id,
                        title: i.title,
                        status: i.status,
                        identifier,
                      })
                    }
                  >
                    <StatusIcon status={i.status} size={15} />
                    <span className={styles.issueTitle}>{i.title}</span>
                    <span
                      className="faint mono"
                      style={{ fontSize: 11, marginLeft: "auto" }}
                    >
                      {identifier}
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>

        <div className={styles.footer}>
          <span className="kbd">↑↓</span> {t.palette.navigate}
          <span className="kbd" style={{ marginLeft: 8 }}>
            ↵
          </span>{" "}
          {t.palette.select}
          <span className="kbd" style={{ marginLeft: 8 }}>
            ESC
          </span>{" "}
          {t.palette.close}
        </div>
      </div>
    </div>,
    document.body,
  );
}
