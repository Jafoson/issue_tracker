import { Icon } from "@iconify/react";
import { Badge } from "@/components/ui/atoms/Badge/Badge";

interface FilterChipProps {
  label: string;
  active: boolean;
  onClear: () => void;
  children: React.ReactNode;
}

export function FilterChip({ label, active, onClear, children }: FilterChipProps) {
  return (
    <Badge as="div" active={active} style={{ gap: 4, padding: 0 }}>
      <span style={{ padding: "0 8px 0 9px", display: "flex", alignItems: "center", gap: 4 }}>
        {children}
        {!active && <Icon icon="lucide:chevron-down" width={13} className="faint" />}
        {active && <span className="faint" style={{ fontSize: 12 }}>{label}</span>}
      </span>
      {active && (
        <button
          className="iconbtn"
          style={{ borderRadius: "0 5px 5px 0", height: "100%", padding: "0 5px" }}
          onClick={(e) => { e.stopPropagation(); onClear(); }}
        >
          <Icon icon="lucide:x" width={12} />
        </button>
      )}
    </Badge>
  );
}
