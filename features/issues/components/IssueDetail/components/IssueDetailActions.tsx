"use client";

import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { getPathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import styles from "../issueDetail.module.scss";

/** Kanonischer Pfad der Vollseite eines Issues, ohne Locale-Präfix. */
export const issuePath = (workspaceId: string, identifier: string) =>
  `/${workspaceId}/issue/${identifier}`;

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
  workspaceId: string;
  identifier: string;
  /** Im Panel führt der Eintrag auf die Vollseite; dort selbst entfällt er. */
  showFullscreen: boolean;
  onDelete: () => void;
}

/** „…“-Menü der Kopfzeile: Vollseite öffnen und Issue löschen. */
export function IssueActionsMenu({
  workspaceId,
  identifier,
  showFullscreen,
  onDelete,
}: IssueActionsMenuProps) {
  const t = useTranslations();
  const router = useRouter();

  const items = [
    ...(showFullscreen
      ? [
          {
            value: "fullscreen",
            label: t("actions.openFullscreen"),
            icon: <Icon icon="lucide:maximize-2" width={15} />,
          },
        ]
      : []),
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
            if (value === "fullscreen")
              router.push(issuePath(workspaceId, identifier));
            if (value === "delete") onDelete();
          }}
          onClose={close}
        />
      )}
    </InlinePicker>
  );
}
