import styles from "./segmentedControl.module.scss";

interface SegmentedItem {
  value: string;
  label?: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps {
  items: SegmentedItem[];
  value: string;
  onChange: (value: string) => void;
  variant?: "primary" | "surface";
}

export function SegmentedControl({
  items,
  value,
  onChange,
  variant = "primary",
}: SegmentedControlProps) {
  return (
    <div className={styles.root}>
      {items.map((item) => {
        const isActive = value === item.value;
        const iconOnly = !!item.icon && !item.label;
        return (
          <button
            key={item.value}
            type="button"
            className={[
              styles.item,
              iconOnly && styles.iconOnly,
              isActive && styles.active,
              isActive && variant === "surface" && styles.activeSurface,
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onChange(item.value)}
            title={item.label}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
