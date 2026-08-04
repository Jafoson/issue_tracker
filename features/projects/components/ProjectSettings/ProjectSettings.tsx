"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { ColorPicker } from "@/components/ui/atoms/ColorPicker/ColorPicker";
import { Input } from "@/components/ui/atoms/Input/Input";
import { SegmentedControl } from "@/components/ui/atoms/SegmentedControl/SegmentedControl";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import { deleteProject, updateProject } from "@/features/projects/actions";
import type {
  ProjectSettingsView,
  ProjectVisibility,
} from "@/features/projects/types";
import { useRouter } from "@/i18n/navigation";
import styles from "./projectSettings.module.scss";

interface Props extends ProjectSettingsView {
  workspaceId: string;
}

/**
 * Die Einstellungen eines Projekts: Stammdaten, Sichtbarkeit, Löschen.
 *
 * Was jemand darf, kommt fertig vom Server (`canUpdate`, `canDelete`) — die
 * Felder hier bauen keine Rechteregeln nach. Ohne `canUpdate` bleibt die Seite
 * lesbar: sie zeigt, was gilt, nur eben unveränderlich.
 */
export function ProjectSettings({
  project,
  canUpdate,
  canDelete,
  workspaceId,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(project.name);
  const [prefix, setPrefix] = useState(project.prefix);
  const [color, setColor] = useState(project.color);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty =
    name.trim() !== project.name ||
    prefix !== project.prefix ||
    color !== project.color;

  const run = (
    action: () => Promise<{ ok: true } | { error: string }>,
    after: () => void,
  ) =>
    startTransition(async () => {
      const result = await action();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError("");
      after();
    });

  const save = () =>
    run(
      () => updateProject(project.id, { name: name.trim(), prefix, color }),
      () => {
        setSaved(true);
        router.refresh();
      },
    );

  // Die Sichtbarkeit speichert sofort: ein Schalter, der erst durch „Speichern"
  // wirkt, sieht aus, als hätte er schon gewirkt.
  const setVisibility = (next: ProjectVisibility) =>
    run(
      () => updateProject(project.id, { visibility: next }),
      () => router.refresh(),
    );

  const remove = () =>
    run(
      () => deleteProject(project.id),
      () => router.push(`/${workspaceId}/projects`),
    );

  return (
    <>
      <PageHeader
        divider={false}
        leading={
          <span
            className={styles.dot}
            style={{ background: project.color }}
            aria-hidden
          />
        }
        title={project.name}
        description={t("projectSettings.subtitle", {
          prefix: project.prefix,
          slug: project.slug,
        })}
      />

      <div className={styles.content}>
        {error && (
          <p className={styles.error} role="alert">
            <Icon icon="lucide:circle-alert" width={14} />
            {error}
          </p>
        )}

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>
            {t("projectSettings.general")}
          </h3>

          <div className={styles.fields}>
            <Input
              label={t("fields.name")}
              value={name}
              disabled={!canUpdate || isPending}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
            />

            <Input
              label={t("projects.identifier")}
              hint={`${t("projects.example")} ${prefix || "WEB"}-123`}
              value={prefix}
              spellCheck={false}
              maxLength={4}
              disabled={!canUpdate || isPending}
              onChange={(e) => {
                setPrefix(
                  e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase(),
                );
                setSaved(false);
              }}
            />

            <div className={styles.field}>
              <span className={styles.label}>{t("fields.color")}</span>
              <ColorPicker
                value={color}
                onChange={(next) => {
                  setColor(next);
                  setSaved(false);
                }}
              />
            </div>
          </div>

          {canUpdate && (
            <div className={styles.actions}>
              {saved && !dirty && (
                <span className={styles.saved}>
                  <Icon icon="lucide:check" width={14} />
                  {t("projectSettings.saved")}
                </span>
              )}
              <Button
                variant="primary"
                disabled={!dirty || !name.trim() || isPending}
                onClick={save}
              >
                {t("actions.save")}
              </Button>
            </div>
          )}
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>
            {t("projectSettings.visibility")}
          </h3>

          <div className={styles.row}>
            <div>
              <div className={styles.rowLabel}>
                {project.visibility === "public"
                  ? t("projectSettings.publicTitle")
                  : t("projectSettings.privateTitle")}
              </div>
              <p className={styles.rowDesc}>
                {project.visibility === "public"
                  ? t("projectSettings.publicDesc")
                  : t("projectSettings.privateDesc")}
              </p>
            </div>
            {canUpdate && (
              <SegmentedControl
                items={[
                  { value: "public", label: t("projectSettings.public") },
                  { value: "private", label: t("projectSettings.private") },
                ]}
                value={project.visibility}
                onChange={(v) => setVisibility(v as ProjectVisibility)}
              />
            )}
          </div>

          <p className={styles.note}>
            <Icon icon="lucide:info" width={14} />
            {t("projectSettings.visibilityNote", {
              count: project.memberCount,
            })}
          </p>
        </section>

        {canDelete && (
          <section className={`${styles.section} ${styles.danger}`}>
            <h3 className={styles.sectionTitle}>
              {t("projectSettings.dangerZone")}
            </h3>

            <div className={styles.row}>
              <div>
                <div className={styles.rowLabel}>
                  {t("projectSettings.deleteTitle")}
                </div>
                <p className={styles.rowDesc}>
                  {t("projectSettings.deleteDesc", {
                    count: project.issueCount,
                  })}
                </p>
              </div>

              {confirmDelete ? (
                <div className={styles.confirm}>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => setConfirmDelete(false)}
                  >
                    {t("actions.cancel")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={styles.deleteButton}
                    disabled={isPending}
                    onClick={remove}
                  >
                    {t("projectSettings.deleteConfirm")}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Icon icon="lucide:trash-2" width={14} />}
                  onClick={() => setConfirmDelete(true)}
                >
                  {t("actions.delete")}
                </Button>
              )}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
