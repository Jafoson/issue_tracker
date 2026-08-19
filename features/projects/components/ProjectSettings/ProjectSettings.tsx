"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Button } from "@/components/ui/atoms/Button/Button";
import { ColorPicker } from "@/components/ui/atoms/ColorPicker/ColorPicker";
import { CopyField } from "@/components/ui/atoms/CopyField/CopyField";
import { Input } from "@/components/ui/atoms/Input/Input";
import { SegmentedControl } from "@/components/ui/atoms/SegmentedControl/SegmentedControl";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import { SettingsIdentity } from "@/components/ui/layout/SettingsIdentity/SettingsIdentity";
import { Table, type TableColumn } from "@/components/ui/layout/Table/Table";
import { deleteProject, updateProject } from "@/features/projects/actions";
import type {
  ProjectSettingsView,
  ProjectVisibility,
} from "@/features/projects/types";
import { useRouter } from "@/i18n/navigation";
import styles from "./projectSettings.module.scss";

interface Props extends ProjectSettingsView {
  workspaceId: string;
  /** Die absolute Adresse des Projekts — fertig zusammengesetzt vom Server. */
  projectUrl: string;
}

/** Eine Einstellung als Zeile: worum es geht, was sie bedeutet, womit man sie ändert. */
interface SettingRow {
  id: string;
  label: string;
  desc: ReactNode;
  control: ReactNode;
}

/**
 * Zwei Spalten für jede Einstellung — und dieselbe Tabelle wie unter Labels und
 * Rollen. Die Definition braucht weder Übersetzung noch Zustand und steht
 * deshalb außerhalb der Komponente.
 *
 * Links, worum es geht (Beschriftung über Erklärung), rechts, womit man es
 * ändert. Die Erklärung nimmt den freien Platz; jedes Bedienelement steht in
 * derselben festen Breite (`.control`), damit die rechten Kanten eine Linie
 * bilden.
 */
const COLUMNS: TableColumn<SettingRow>[] = [
  {
    id: "setting",
    width: "minmax(0, 1fr)",
    cell: (row) => (
      <div className={styles.setting}>
        <span className={styles.label}>{row.label}</span>
        <span className={styles.desc}>{row.desc}</span>
      </div>
    ),
  },
  {
    id: "control",
    width: "minmax(280px, max-content)",
    align: "end",
    cell: (row) => row.control,
  },
];

/**
 * Die Stammdaten eines Projekts: Name, Kürzel, Farbe, Sichtbarkeit, Löschen.
 *
 * Was jemand darf, kommt fertig vom Server (`canUpdate`, `canDelete`) — die
 * Felder hier bauen keine Rechteregeln nach. Ohne `canUpdate` bleibt die Seite
 * lesbar: sie zeigt, was gilt, nur eben unveränderlich.
 *
 * Aufgebaut wie die übrigen Bereiche der Einstellungen: Kopfzeile mit der
 * Aktion rechts, darunter Listen in Karten, dazwischen Überschriften. Die drei
 * Textfelder teilen sich den Speichern-Knopf im Seitenkopf: wer ein Kürzel
 * ändert, prüft meist auch gleich den Namen, und drei einzelne Knöpfe würden
 * dafür drei Runden zum Server brauchen. Die Sichtbarkeit hat keinen — sie ist
 * ein Schalter, und ein Schalter, der erst durch „Speichern" wirkt, sieht aus,
 * als hätte er schon gewirkt.
 */
export function ProjectSettings({
  project,
  canUpdate,
  canDelete,
  workspaceId,
  projectUrl,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(project.name);
  const [desc, setDesc] = useState(project.desc);
  const [prefix, setPrefix] = useState(project.prefix);
  const [color, setColor] = useState(project.color);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty =
    name.trim() !== project.name ||
    desc.trim() !== project.desc ||
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
      () =>
        updateProject(project.id, { name: name.trim(), desc, prefix, color }),
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

  const general: SettingRow[] = [
    // Der Slug steht in jeder URL des Projekts und ändert sich nicht mit dem
    // Namen — sonst bräche jeder geteilte Link. Deshalb steht er hier zum
    // Nachlesen und Mitnehmen, nicht als Feld.
    {
      id: "url",
      label: t("projectSettings.url"),
      desc: t("projectSettings.urlDesc"),
      control: (
        <div className={`${styles.control} ${styles.urlControl}`}>
          <CopyField
            value={projectUrl}
            copyLabel={t("actions.copyLink")}
            copiedLabel={t("actions.linkCopied")}
          />
        </div>
      ),
    },
  ];

  const visibility: SettingRow[] = [
    {
      id: "visibility",
      label:
        project.visibility === "public"
          ? t("projectSettings.publicTitle")
          : t("projectSettings.privateTitle"),
      desc:
        project.visibility === "public"
          ? t("projectSettings.publicDesc")
          : t("projectSettings.privateDesc"),
      control: canUpdate && (
        <SegmentedControl
          items={[
            { value: "public", label: t("projectSettings.public") },
            { value: "private", label: t("projectSettings.private") },
          ]}
          value={project.visibility}
          onChange={(v) => setVisibility(v as ProjectVisibility)}
        />
      ),
    },
  ];

  const danger: SettingRow[] = [
    {
      id: "delete",
      label: t("projectSettings.deleteTitle"),
      desc: t("projectSettings.deleteDesc", { count: project.issueCount }),
      control: confirmDelete ? (
        <div className={styles.confirm}>
          <Button
            variant="text"
            disabled={isPending}
            onClick={() => setConfirmDelete(false)}
          >
            {t("actions.cancel")}
          </Button>
          <Button
            variant="outline"
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
          className={styles.deleteButton}
          icon={<Icon icon="lucide:trash-2" width={14} />}
          onClick={() => setConfirmDelete(true)}
        >
          {t("actions.delete")}
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        divider={false}
        title={t("nav.general")}
        description={t("projectSettings.generalDesc")}
        actions={
          canUpdate && (
            <>
              {/* Verschwindet, sobald wieder etwas geändert wird — die
                  Bestätigung gehört zum abgeschlossenen Vorgang. */}
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
            </>
          )
        }
      />

      <div className={styles.content}>
        {error && (
          <p className={styles.error} role="alert">
            <Icon icon="lucide:circle-alert" width={14} />
            {error}
          </p>
        )}

        <SettingsIdentity
          avatar={<Avatar avatar={{ name, color }} shape="square" size={140} />}
        >
          <Input
            label={t("fields.name")}
            value={name}
            disabled={!canUpdate || isPending}
            onChange={(e) => {
              setName(e.target.value);
              touch();
            }}
          />
          <Input
            label={t("fields.description")}
            placeholder={t("projects.descPlaceholder")}
            value={desc}
            disabled={!canUpdate || isPending}
            onChange={(e) => {
              setDesc(e.target.value);
              touch();
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
              touch();
            }}
          />
          <div className={styles.field}>
            <span className={styles.fieldLabel}>{t("fields.color")}</span>
            {canUpdate ? (
              <ColorPicker
                value={color}
                onChange={(next) => {
                  setColor(next);
                  touch();
                }}
              />
            ) : (
              // Ohne Schreibrecht bleibt von der Farbwahl nur die Farbe.
              <span
                role="img"
                className={styles.colorProof}
                style={{ background: color }}
                aria-label={color}
              />
            )}
          </div>
        </SettingsIdentity>

        <Table
          variant="card"
          label={t("nav.general")}
          columns={COLUMNS}
          rows={general}
          getRowKey={(row) => row.id}
        />

        <section className={styles.group}>
          <h2 className={styles.groupTitle}>
            {t("projectSettings.visibility")}
          </h2>
          {/* Steht über der Karte, nicht darin: der Satz erklärt die Grenze des
              Schalters, nicht seine Funktion. */}
          <p className={styles.groupDesc}>
            {t("projectSettings.visibilityNote", {
              count: project.memberCount,
            })}
          </p>
          <Table
            variant="card"
            label={t("projectSettings.visibility")}
            columns={COLUMNS}
            rows={visibility}
            getRowKey={(row) => row.id}
          />
        </section>

        {canDelete && (
          <section className={styles.group}>
            <h2 className={`${styles.groupTitle} ${styles.dangerTitle}`}>
              {t("projectSettings.dangerZone")}
            </h2>
            <Table
              variant="card"
              className={styles.dangerCard}
              label={t("projectSettings.dangerZone")}
              columns={COLUMNS}
              rows={danger}
              getRowKey={(row) => row.id}
            />
          </section>
        )}
      </div>
    </>
  );
}
