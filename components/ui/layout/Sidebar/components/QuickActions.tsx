import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/atoms/Button/Button";
import type { T } from "@/lib/i18n";

interface QuickActionsProps {
  t: T;
}

export function QuickActions({ t }: QuickActionsProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "6px 8px" }}>
      <Button
        variant="primary"
        full
        icon={<Icon icon="lucide:plus" width={16} />}
        onClick={() => (window as { __openComposer?: () => void }).__openComposer?.()}
      >
        {t.actions.newIssue}
      </Button>
      <button
        className="orbit-search-btn"
        onClick={() => (window as { __openPalette?: () => void }).__openPalette?.()}
      >
        <Icon icon="lucide:search" width={15} />
        <span>{t.placeholders.search}</span>
        <span className="kbd" style={{ marginLeft: "auto" }}>⌘K</span>
      </button>
    </div>
  );
}
