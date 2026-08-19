"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState, useTransition } from "react";
import { AvatarUploader } from "@/components/ui/atoms/AvatarUploader/AvatarUploader";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Chip } from "@/components/ui/atoms/Chip/Chip";
import { ColorPicker } from "@/components/ui/atoms/ColorPicker/ColorPicker";
import { CopyField } from "@/components/ui/atoms/CopyField/CopyField";
import { Input } from "@/components/ui/atoms/Input/Input";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import { Table, type TableColumn } from "@/components/ui/layout/Table/Table";
import {
  addWorkspaceDomain,
  confirmWorkspaceAvatarUpload,
  deleteWorkspace,
  removeWorkspaceAvatar,
  removeWorkspaceDomain,
  requestWorkspaceAvatarUploadUrl,
  updateWorkspace,
} from "@/features/workspaces/actions";
import type { WorkspaceSettingsView } from "@/features/workspaces/types";
import { useRouter } from "@/i18n/navigation";
import { useModal } from "@/lib/context";
import { AddLinkDialog } from "./components/AddLinkDialog";
import styles from "./workspaceSettings.module.scss";

interface Props extends WorkspaceSettingsView {
  /** Die absolute Adresse des Workspace — fertig zusammengesetzt vom Server. */
  workspaceUrl: string;
}

/** Eine Einstellung als Zeile: worum es geht, was sie bedeutet, womit man sie ändert. */
interface SettingRow {
  id: string;
  label: string;
  desc: ReactNode;
  control: ReactNode;
}

/**
 * Dasselbe Raster wie in den Projekteinstellungen: links, worum es geht
 * (Beschriftung über Erklärung), rechts, womit man es ändert. Die Erklärung
 * nimmt den freien Platz; jedes Bedienelement steht in derselben festen Breite
 * (`.control`), damit die rechten Kanten eine Linie bilden.
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
 * Die Stammdaten eines Workspace: Name, Farbe, Adresse, Löschen.
 *
 * Was jemand darf, kommt fertig vom Server (`canUpdate`, `canDelete`) — die
 * Felder hier bauen keine Rechteregeln nach. Ohne `canUpdate` bleibt die Seite
 * lesbar: sie zeigt, was gilt, nur eben unveränderlich.
 *
 * Name und Farbe teilen sich den Speichern-Knopf im Seitenkopf: wer das eine
 * ändert, sieht meist auch das andere durch, und zwei Knöpfe brauchten dafür
 * zwei Runden zum Server.
 */
/** Ein Link im Formular — `key` ist die Server-Id oder, für einen frisch im
 * Dialog angelegten, eine clientseitig erzeugte, damit React ihn über
 * Änderungen der Liste hinweg wiedererkennt. */
interface LinkDraft {
  key: string;
  label: string;
  url: string;
}

export function WorkspaceSettings({
  workspace,
  canUpdate,
  canDelete,
  workspaceUrl,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const { openModal } = useModal();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(workspace.name);
  const [color, setColor] = useState(workspace.color);
  const [desc, setDesc] = useState(workspace.desc);
  const [links, setLinks] = useState<LinkDraft[]>(() =>
    workspace.links.map((link) => ({ key: link.id, ...link })),
  );
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Domains schreiben sofort (eigene Server-Aktion, eigene Validierung —
  // Sperrliste und Eindeutigkeit brauchen eine Serverantwort pro Eintrag), im
  // Unterschied zu Name/Farbe/Links, die erst der "Speichern"-Knopf schreibt.
  const [domains, setDomains] = useState<string[]>(workspace.domains);
  const [domainInput, setDomainInput] = useState("");
  const [domainError, setDomainError] = useState("");

  const linksChanged =
    JSON.stringify(links.map(({ label, url }) => ({ label, url }))) !==
    JSON.stringify(workspace.links.map(({ label, url }) => ({ label, url })));

  const dirty =
    name.trim() !== workspace.name ||
    color !== workspace.color ||
    desc !== workspace.desc ||
    linksChanged;

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
        updateWorkspace(workspace.id, {
          name: name.trim(),
          color,
          desc,
          links: links.map(({ label, url }) => ({ label, url })),
        }),
      () => {
        setSaved(true);
        router.refresh();
      },
    );

  const remove = () =>
    run(
      () => deleteWorkspace(workspace.id),
      // Der Workspace, in dem man stand, gibt es nicht mehr — die Wurzel
      // sortiert von dort aus in einen verbliebenen oder zum Anlegen.
      () => router.push("/"),
    );

  const touch = () => setSaved(false);

  const addLink = (link: { label: string; url: string }) => {
    setLinks((current) => [...current, { key: crypto.randomUUID(), ...link }]);
    touch();
  };

  const removeLink = (key: string) => {
    setLinks((current) => current.filter((link) => link.key !== key));
    touch();
  };

  const openAddLink = () =>
    openModal(({ close }) => <AddLinkDialog close={close} onAdd={addLink} />, {
      label: t("workspaceSettings.addLink"),
    });

  const addDomain = () => {
    const value = domainInput.trim();
    if (!value || isPending) return;

    startTransition(async () => {
      const result = await addWorkspaceDomain(workspace.id, value);
      if ("error" in result) {
        setDomainError(result.error);
        return;
      }
      setDomainError("");
      setDomainInput("");
      setDomains((current) =>
        [...current, value.toLowerCase().replace(/^@/, "")].sort(),
      );
      router.refresh();
    });
  };

  const removeDomain = (domain: string) => {
    startTransition(async () => {
      const result = await removeWorkspaceDomain(workspace.id, domain);
      if ("error" in result) {
        setDomainError(result.error);
        return;
      }
      setDomainError("");
      setDomains((current) => current.filter((d) => d !== domain));
      router.refresh();
    });
  };

  const general: SettingRow[] = [
    {
      id: "avatar",
      label: t("workspaceSettings.avatar"),
      desc: t("workspaceSettings.avatarDesc"),
      control: (
        <AvatarUploader
          avatar={{ name, color, image: workspace.avatarUrl ?? undefined }}
          shape="square"
          disabled={!canUpdate || isPending}
          onRequestUpload={(input) =>
            requestWorkspaceAvatarUploadUrl(workspace.id, input)
          }
          onConfirmUpload={(key) =>
            confirmWorkspaceAvatarUpload(workspace.id, key)
          }
          onRemove={
            canUpdate ? () => removeWorkspaceAvatar(workspace.id) : undefined
          }
          onDone={() => router.refresh()}
        />
      ),
    },
    {
      id: "name",
      label: t("fields.name"),
      desc: t("workspaceSettings.nameDesc"),
      control: (
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
      ),
    },
    {
      id: "desc",
      label: t("fields.description"),
      desc: t("workspaceSettings.descDesc"),
      control: (
        <div className={styles.control}>
          <Input
            aria-label={t("fields.description")}
            placeholder={t("workspaceSettings.descPlaceholder")}
            value={desc}
            disabled={!canUpdate || isPending}
            onChange={(e) => {
              setDesc(e.target.value);
              touch();
            }}
          />
        </div>
      ),
    },
    {
      id: "color",
      label: t("fields.color"),
      desc: t("workspaceSettings.colorDesc"),
      control: canUpdate ? (
        <div className={styles.control}>
          <ColorPicker
            size="sm"
            value={color}
            onChange={(next) => {
              setColor(next);
              touch();
            }}
          />
        </div>
      ) : (
        // Ohne Schreibrecht bleibt von der Farbwahl nur die Farbe.
        <span
          role="img"
          className={styles.colorProof}
          style={{ background: color }}
          aria-label={color}
        />
      ),
    },
    // Der Slug ist zugleich die Id des Workspace: er steht in jeder Adresse und
    // in jeder verschickten Einladung. Deshalb steht er hier zum Nachlesen und
    // Mitnehmen, nicht als Feld.
    {
      id: "url",
      label: t("workspaceSettings.url"),
      desc: t("workspaceSettings.urlDesc"),
      control: (
        <div className={`${styles.control} ${styles.urlControl}`}>
          <CopyField
            value={workspaceUrl}
            copyLabel={t("actions.copyLink")}
            copiedLabel={t("actions.linkCopied")}
          />
        </div>
      ),
    },
  ];

  // Kein Bedienelement, nur Zahlen: was im Workspace steckt, sagt vor dem
  // Löschen mehr als jeder Warnsatz.
  const content: SettingRow[] = [
    {
      id: "projects",
      label: t("nav.projects"),
      desc: t("workspaceSettings.projectsDesc"),
      control: <span className={styles.stat}>{workspace.projectCount}</span>,
    },
    {
      id: "members",
      label: t("nav.members"),
      desc: t("workspaceSettings.membersDesc"),
      control: <span className={styles.stat}>{workspace.memberCount}</span>,
    },
    {
      id: "issues",
      label: t("nav.issues"),
      desc: t("workspaceSettings.issuesDesc"),
      control: <span className={styles.stat}>{workspace.issueCount}</span>,
    },
  ];

  const danger: SettingRow[] = [
    {
      id: "delete",
      label: t("workspaceSettings.deleteTitle"),
      desc: t("workspaceSettings.deleteDesc", {
        projects: workspace.projectCount,
        issues: workspace.issueCount,
      }),
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
            {t("workspaceSettings.deleteConfirm")}
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
        description={t("workspaceSettings.generalDesc")}
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

        <Table
          variant="card"
          label={t("nav.general")}
          columns={COLUMNS}
          rows={general}
          getRowKey={(row) => row.id}
        />

        <section className={styles.group}>
          <h2 className={styles.groupTitle}>{t("workspaceSettings.links")}</h2>

          <div className={styles.linksRow}>
            {links.map((link) => (
              <Chip
                key={link.key}
                type="input"
                icon={<Icon icon="lucide:link" width={14} />}
                onRemove={canUpdate ? () => removeLink(link.key) : undefined}
                removeLabel={t("workspaceSettings.removeLink")}
                disabled={isPending}
              >
                {link.label}
              </Chip>
            ))}

            {canUpdate && (
              <Button
                variant="elevated"
                icon={<Icon icon="lucide:plus" width={14} />}
                disabled={isPending}
                onClick={openAddLink}
              >
                {t("workspaceSettings.addLink")}
              </Button>
            )}

            {links.length === 0 && !canUpdate && (
              <span className={styles.linksEmpty}>
                {t("workspaceSettings.linksEmpty")}
              </span>
            )}
          </div>
        </section>

        <section className={styles.group}>
          <h2 className={styles.groupTitle}>
            {t("workspaceSettings.domains")}
          </h2>
          <p className={styles.groupDesc}>
            {t("workspaceSettings.domainsDesc")}
          </p>

          {domainError && (
            <p className={styles.error} role="alert">
              <Icon icon="lucide:circle-alert" width={14} />
              {domainError}
            </p>
          )}

          <div className={styles.linksRow}>
            {domains.map((domain) => (
              <Chip
                key={domain}
                type="input"
                icon={<Icon icon="lucide:at-sign" width={14} />}
                onRemove={canUpdate ? () => removeDomain(domain) : undefined}
                removeLabel={t("workspaceSettings.removeDomain")}
                disabled={isPending}
              >
                {domain}
              </Chip>
            ))}

            {canUpdate && (
              <div className={styles.domainAdd}>
                <Input
                  aria-label={t("workspaceSettings.domainPlaceholder")}
                  size="sm"
                  placeholder={t("workspaceSettings.domainPlaceholder")}
                  value={domainInput}
                  disabled={isPending}
                  onChange={(e) => setDomainInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addDomain()}
                />
                <Button
                  variant="elevated"
                  icon={<Icon icon="lucide:plus" width={14} />}
                  disabled={isPending || !domainInput.trim()}
                  onClick={addDomain}
                >
                  {t("workspaceSettings.addDomain")}
                </Button>
              </div>
            )}

            {domains.length === 0 && !canUpdate && (
              <span className={styles.linksEmpty}>
                {t("workspaceSettings.domainsEmpty")}
              </span>
            )}
          </div>
        </section>

        <section className={styles.group}>
          <h2 className={styles.groupTitle}>
            {t("workspaceSettings.content")}
          </h2>
          <Table
            variant="card"
            label={t("workspaceSettings.content")}
            columns={COLUMNS}
            rows={content}
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
