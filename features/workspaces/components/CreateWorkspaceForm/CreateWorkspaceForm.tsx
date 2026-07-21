"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import {
  createWorkspace,
  suggestWorkspaceSlug,
} from "@/features/workspaces/actions";
import { useRouter } from "@/i18n/navigation";
import { COLORS } from "@/styles/colors";
import { IconColorPicker } from "./components/IconColorPicker";
import { WorkspaceNameField } from "./components/WorkspaceNameField";
import styles from "./createWorkspaceForm.module.scss";

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
  const t = useTranslations();
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
    const timer = setTimeout(async () => {
      const free = await suggestWorkspaceSlug(base);
      if (!cancelled) setSlug(free);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
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
      setError(t("workspaces.nameRequired"));
      return;
    }
    if (!slug.trim()) {
      setError(t("workspaces.slugRequired"));
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

  return (
    <div className={styles.backdrop}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>
            {t("workspaces.modalTitle")}
          </span>
        </div>

        <p className={styles.description}>{t("workspaces.modalDescription")}</p>

        <WorkspaceNameField
          name={name}
          onNameChange={setName}
          color={color}
          nameRef={nameRef}
        />

        <IconColorPicker color={color} onChange={setColor} />

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.footer}>
          <div className={styles.shortcut}>
            <kbd>⌘</kbd>
            <kbd>↵</kbd> {t("workspaces.toCreate")}
          </div>
          <div className={styles.footerActions}>
            <Button variant="ghost" onClick={() => router.back()}>
              {t("actions.cancel")}
            </Button>
            <Button variant="primary" onClick={submit}>
              {t("actions.createWorkspace")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
