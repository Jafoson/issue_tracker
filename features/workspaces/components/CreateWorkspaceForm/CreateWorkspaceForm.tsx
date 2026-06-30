"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import {
  createWorkspace,
  suggestWorkspaceSlug,
} from "@/features/workspaces/actions";
import { useRouter } from "@/i18n/navigation";
import styles from "./createWorkspaceForm.module.scss";

const COLORS = [
  "#6e63e6",
  "#3b9d6e",
  "#d5733b",
  "#3b7bd5",
  "#c2456b",
  "#a05fd0",
  "#cf9a3b",
];

function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

export function CreateWorkspaceForm() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useEffect(() => {
    if (slugTouched) return;
    const base = toSlug(name);
    setSlug(base); // instant preview while we ask the server for a free slug
    if (!base) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const free = await suggestWorkspaceSlug(base);
      if (!cancelled) setSlug(free);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [name, slugTouched]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function submit() {
    if (!name.trim()) {
      setError("Workspace name is required.");
      return;
    }
    if (!slug.trim()) {
      setError("Slug is required.");
      return;
    }
    setError("");

    const fd = new FormData();
    fd.append("name", name.trim());
    fd.append("slug", slug.trim());
    fd.append("color", color);

    startTransition(async () => {
      const result = await createWorkspace(fd);
      if ("error" in result) setError(result.error);
      else router.push(result.redirectTo);
    });
  }

  const letter = name.trim()[0]?.toUpperCase() ?? "W";

  return (
    <div className={styles.backdrop}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>Create a workspace</span>
        </div>

        <p className={styles.description}>
          A workspace is where your team's projects and issues live.
        </p>

        <div className={styles.nameRow}>
          <div className={styles.iconPreview} style={{ background: color }}>
            {letter}
          </div>
          <div className={styles.nameField}>
            <label className={styles.label} htmlFor="ws-name">
              Workspace name
            </label>
            <input
              ref={nameRef}
              id="ws-name"
              className={styles.input}
              placeholder="Acme Inc."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Icon color</span>
          <div className={styles.swatches}>
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`${styles.swatch}${c === color ? ` ${styles.swatchActive}` : ""}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="ws-slug">
            Slug
          </label>
          <input
            id="ws-slug"
            className={styles.input}
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(toSlug(e.target.value));
            }}
            spellCheck={false}
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.footer}>
          <div className={styles.shortcut}>
            <kbd>⌘</kbd>
            <kbd>↵</kbd> to create
          </div>
          <div className={styles.footerActions}>
            <Button variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit}>
              Create workspace
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
