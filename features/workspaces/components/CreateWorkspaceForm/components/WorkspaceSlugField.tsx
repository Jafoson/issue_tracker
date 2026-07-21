"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/atoms/Input/Input";

interface WorkspaceSlugFieldProps {
  slug: string;
  onSlugChange: (value: string) => void;
}

export function WorkspaceSlugField({
  slug,
  onSlugChange,
}: WorkspaceSlugFieldProps) {
  const t = useTranslations();

  return (
    <Input
      id="ws-slug"
      label={t("workspaces.slug")}
      value={slug}
      onChange={(e) => onSlugChange(e.target.value)}
      spellCheck={false}
    />
  );
}
