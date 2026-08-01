"use client";

import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { issuePath } from "@/features/issues/issue-links";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import styles from "../issueDetail.module.scss";

interface OpenPageButtonProps {
  workspaceId: string;
  identifier: string;
}

/**
 * Führt aus Panel und Dialog auf die Vollseite des Issues.
 *
 * Ein Link, kein Knopf mit `router.push`: die Seite ist ein Ort, und den soll
 * man auch mit Cmd-Klick in einem neuen Tab öffnen können. Aussehen und Maße
 * kommen aus `.headerLink` — dieselben wie bei den Ghost-Buttons daneben.
 */
export function OpenPageButton({
  workspaceId,
  identifier,
}: OpenPageButtonProps) {
  const t = useTranslations();
  const label = t("actions.openPage");

  return (
    <Link
      href={issuePath(workspaceId, identifier)}
      className={styles.headerLink}
      aria-label={label}
      title={label}
    >
      <Icon icon="lucide:external-link" width={15} aria-hidden="true" />
    </Link>
  );
}

interface CopyLinkButtonProps {
  workspaceId: string;
  identifier: string;
}

/**
 * Kopiert die Vollseiten-Adresse des Issues — nicht die aktuelle URL, damit im
 * Panel nicht die Filter der Liste mitwandern.
 */
export function CopyLinkButton({
  workspaceId,
  identifier,
}: CopyLinkButtonProps) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const path = getPathname({
      href: issuePath(workspaceId, identifier),
      locale,
    });
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Ohne Clipboard-Freigabe (oder ohne HTTPS) bleibt es beim Versuch.
    }
  };

  const label = copied ? t("actions.linkCopied") : t("actions.copyLink");

  return (
    <Button
      variant="ghost"
      size="sm"
      icon={
        <Icon icon={copied ? "lucide:check" : "lucide:link-2"} width={15} />
      }
      className={copied ? styles.copied : undefined}
      aria-label={label}
      title={label}
      onClick={copy}
    />
  );
}

interface IssueActionsMenuProps {
  onDelete: () => void;
}

/**
 * „…“-Menü der Kopfzeile.
 *
 * Der Weg auf die Vollseite stand hier einmal als Eintrag — er ist jetzt ein
 * eigener Knopf daneben (`OpenPageButton`), und zweimal dieselbe Aktion in
 * derselben Zeile wäre nur Rauschen.
 */
export function IssueActionsMenu({ onDelete }: IssueActionsMenuProps) {
  const t = useTranslations();

  const items = [
    {
      value: "delete",
      label: t("actions.deleteIssue"),
      icon: <Icon icon="lucide:trash-2" width={15} />,
    },
  ];

  return (
    <InlinePicker
      width={200}
      align="end"
      trigger={
        <Button
          variant="ghost"
          size="sm"
          icon={<Icon icon="lucide:more-horizontal" width={16} />}
          aria-label={t("actions.moreActions")}
          title={t("actions.moreActions")}
        />
      }
    >
      {(close) => (
        <SelectMenu
          items={items}
          value={null}
          onPick={(value) => {
            close();
            if (value === "delete") onDelete();
          }}
          onClose={close}
        />
      )}
    </InlinePicker>
  );
}
