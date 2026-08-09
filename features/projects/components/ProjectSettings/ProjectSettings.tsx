"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { ColorPicker } from "@/components/ui/atoms/ColorPicker/ColorPicker";
import { CopyField } from "@/components/ui/atoms/CopyField/CopyField";
import { Input } from "@/components/ui/atoms/Input/Input";
import { SegmentedControl } from "@/components/ui/atoms/SegmentedControl/SegmentedControl";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import { deleteProject, updateProject } from "@/features/projects/actions";
import type {
  ProjectSettingsView,
  ProjectVisibility,
} from "@/features/projects/types";
import { useRouter } from "@/i18n/navigation";
import { projectPath } from "@/lib/nav";
import styles from "./projectSettings.module.scss";

interface Props extends ProjectSettingsView {
  workspaceId: string;
}

/**
 * Die Stammdaten eines Projekts: Name, Kürzel, Farbe, Sichtbarkeit, Löschen.
 *
 * Was jemand darf, kommt fertig vom Server (`canUpdate`, `canDelete`) — die
 * Felder hier bauen keine Rechteregeln nach. Ohne `canUpdate` bleibt die Seite
 * lesbar: sie zeigt, was gilt, nur eben unveränderlich.
 *
 * Jede Einstellung ist eine Zeile mit Erklärung links und Steuerung rechts. Die
 * drei Textfelder teilen sich einen Speichern-Knopf am Fuß der Karte: wer ein
 * Kürzel ändert, prüft meist auch gleich den Namen, und drei einzelne Knöpfe
 * würden dafür drei Runden zum Server brauchen. Die Sichtbarkeit hat keinen —
 * sie ist ein Schalter, und ein Schalter, der erst durch „Speichern" wirkt,
 * sieht aus, als hätte er schon gewirkt.
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

  const touch = () => setSaved(false);

  return (
    <>
      <PageHeader
        divider={false}
        title={t("nav.general")}
        description={t("projectSettings.generalDesc")}
      />

      <div className={styles.content}>
        {error && (
          <p className={styles.error} role="alert">
            <Icon icon="lucide:circle-alert" width={14} />
            {error}
          </p>
        )}

        <section className={styles.card}>
          <div className={styles.row}>
            <div className={styles.rowText}>
              <div className={styles.rowLabel}>{t("fields.name")}</div>
              <p className={styles.rowDesc}>{t("projectSettings.nameDesc")}</p>
            </div>
            <div className={styles.control}>
              <Input
                aria-label={t("fields.name")}
                value={name}
                disabled={!canUpdate || isPending}
                onChange={(e) => {
                  setName(e.target.value);
                  touch();
                }}
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.rowText}>
              <div className={styles.rowLabel}>{t("projects.identifier")}</div>
              <p className={styles.rowDesc}>
                {t("projects.example")} {prefix || "WEB"}-123
              </p>
            </div>
            <div className={styles.control}>
              <Input
                aria-label={t("projects.identifier")}
                value={prefix}
                spellCheck={false}
                maxLength={4}
                disabled={!canUpdate || isPending}
                onChange={(e) => {
                  setPrefix(
                    e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase(),
                  );
                  touch();
                }}
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.rowText}>
              <div className={styles.rowLabel}>{t("fields.color")}</div>
              <p className={styles.rowDesc}>{t("projectSettings.colorDesc")}</p>
            </div>
            {canUpdate ? (
              <ColorPicker
                size="sm"
                value={color}
                onChange={(next) => {
                  setColor(next);
                  touch();
                }}
              />
            ) : (
              <span
                role="img"
                className={styles.colorProof}
                style={{ background: color }}
                aria-label={color}
              />
            )}
          </div>

          {/* Der Slug steht in jeder URL des Projekts und ändert sich nicht mit
              dem Namen — sonst bräche jeder geteilte Link. Deshalb steht er
              hier zum Nachlesen und Mitnehmen, nicht als Feld. */}
          <div className={styles.row}>
            <div className={styles.rowText}>
              <div className={styles.rowLabel}>{t("projectSettings.url")}</div>
              <p className={styles.rowDesc}>{t("projectSettings.urlDesc")}</p>
            </div>
            <CopyField
              value={projectPath(workspaceId, project.slug, "")}
              copyLabel={t("actions.copyLink")}
              copiedLabel={t("actions.linkCopied")}
            />
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

        <h2 className={styles.groupTitle}>{t("projectSettings.visibility")}</h2>

        <section className={styles.card}>
          <div className={styles.row}>
            <div className={styles.rowText}>
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
          <>
            <h2 className={`${styles.groupTitle} ${styles.dangerTitle}`}>
              {t("projectSettings.dangerZone")}
            </h2>

            <section className={`${styles.card} ${styles.danger}`}>
              <div className={styles.row}>
                <div className={styles.rowText}>
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
                    variant="outline"
                    size="sm"
                    className={styles.deleteButton}
                    icon={<Icon icon="lucide:trash-2" width={14} />}
                    onClick={() => setConfirmDelete(true)}
                  >
                    {t("actions.delete")}
                  </Button>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}
