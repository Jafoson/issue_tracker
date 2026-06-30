"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/atoms/Button/Button";
import { createProject } from "@/features/projects/actions";
import styles from "./projectComposer.module.scss";

const COLORS = [
  "#6e63e6",
  "#3b9d6e",
  "#d5733b",
  "#3b7bd5",
  "#c2456b",
  "#a05fd0",
  "#cf9a3b",
  "#5b9c9c",
];

function suggestPrefix(name: string) {
  return name
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 4);
}

interface Props {
  workspaceId: string;
  /** Custom trigger. Receives an `open` callback. Defaults to a primary "New project" button. */
  trigger?: (open: () => void) => React.ReactNode;
}

export function ProjectComposer({ workspaceId, trigger }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [prefixTouched, setPrefixTouched] = useState(false);
  const [color, setColor] = useState(COLORS[0]);
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setPrefix("");
      setPrefixTouched(false);
      setColor(COLORS[0]);
      setError("");
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [open]);

  const effectivePrefix = prefixTouched ? prefix : suggestPrefix(name);

  const submit = () => {
    if (!name.trim()) return;
    setError("");
    startTransition(async () => {
      const result = await createProject({
        workspaceId,
        name: name.trim(),
        prefix: effectivePrefix,
        color,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  return (
    <>
      {trigger ? (
        trigger(() => setOpen(true))
      ) : (
        <Button
          variant="primary"
          size="sm"
          icon={<Icon icon="lucide:plus" width={15} />}
          onClick={() => setOpen(true)}
        >
          {t("actions.newProject")}
        </Button>
      )}

      {open &&
        createPortal(
          <div className={`orbit-overlay ${styles.overlay}`}>
            <button
              type="button"
              className="orbit-backdrop"
              aria-label="Close"
              onClick={() => setOpen(false)}
            />
            <div className="orbit-comp">
              <div className={styles.header}>
                <div className={styles.headerLeft}>
                  <Icon
                    icon="lucide:columns-2"
                    width={18}
                    className={styles.headerIcon}
                  />
                  <span className={styles.headerTitle}>
                    {t("projects.modalTitle")}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Icon icon="lucide:x" width={16} />}
                  onClick={() => setOpen(false)}
                  title={t("actions.cancel")}
                />
              </div>

              <div className={styles.body}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="project-name">
                    {t("placeholders.projectName")}
                  </label>
                  <input
                    ref={nameRef}
                    id="project-name"
                    className={styles.input}
                    placeholder="Web App"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="project-prefix">
                    {t("projects.identifier")}
                    <span className={styles.labelHint}>
                      {" · "}
                      {t("projects.issuePrefix")}
                    </span>
                  </label>
                  <div className={styles.prefixRow}>
                    <input
                      id="project-prefix"
                      className={`${styles.input} ${styles.prefixInput}`}
                      value={effectivePrefix}
                      placeholder="WEB"
                      spellCheck={false}
                      maxLength={4}
                      onChange={(e) => {
                        setPrefixTouched(true);
                        setPrefix(suggestPrefix(e.target.value));
                      }}
                    />
                    <span className={styles.prefixExample}>
                      {t("projects.example")} {effectivePrefix || "WEB"}-123
                    </span>
                  </div>
                </div>

                <div className={styles.field}>
                  <span className={styles.label}>{t("fields.color")}</span>
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

                {error && <p className={styles.error}>{error}</p>}
              </div>

              <div className={styles.footer}>
                <div className={styles.shortcut}>
                  <kbd>⌘</kbd>
                  <kbd>↵</kbd> {t("projects.toCreate")}
                </div>
                <div className={styles.footerActions}>
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    {t("actions.cancel")}
                  </Button>
                  <Button
                    variant="primary"
                    disabled={!name.trim() || isPending}
                    onClick={submit}
                  >
                    {t("actions.createProject")}
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
