import { Icon } from "@iconify/react";
import styles from "./chip.module.scss";

type ChipVariant = "text" | "elevated" | "outline";
type ChipType = "assist" | "filter" | "input";

interface ChipProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> {
  variant?: ChipVariant;
  type?: ChipType;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  removeLabel?: string;
}

export function Chip({
  children,
  variant = "outline",
  type = "assist",
  icon,
  trailing,
  selected = false,
  disabled = false,
  onClick,
  onRemove,
  removeLabel = "Entfernen",
  className,
  ...rest
}: ChipProps) {
  const clickable = !!onClick && !disabled;
  // Assist chips are pure actions — nothing to take back off them.
  const removable = type !== "assist" && !!onRemove;
  // An explicit icon wins: it usually carries more meaning (status, avatar,
  // label color) than the generic selection checkmark it would replace.
  const leadingIcon =
    icon ??
    (type === "filter" && selected ? (
      <Icon icon="lucide:check" width={14} />
    ) : null);

  const cls = [
    styles.chip,
    styles[variant],
    selected && styles.selected,
    clickable && styles.clickable,
    disabled && styles.disabled,
    !!leadingIcon && styles.hasIcon,
    removable && styles.hasRemove,
    !removable && !!trailing && styles.hasTrailing,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {leadingIcon && <span className={styles.icon}>{leadingIcon}</span>}
      <span className={styles.label}>{children}</span>
      {!removable && trailing && (
        <span className={styles.trailing}>{trailing}</span>
      )}
      {removable && (
        <button
          type="button"
          className={styles.remove}
          disabled={disabled}
          aria-label={removeLabel}
          onClick={(event) => {
            event.stopPropagation();
            onRemove?.();
          }}
        >
          <Icon icon="lucide:x" width={12} />
        </button>
      )}
    </>
  );

  if (clickable) {
    return (
      // biome-ignore lint/a11y/useSemanticElements: chip may contain a nested remove <button>; a <button> root would be invalid HTML
      <div
        className={cls}
        role="button"
        tabIndex={0}
        aria-pressed={type === "filter" ? selected : undefined}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick?.();
          }
        }}
        {...rest}
      >
        {content}
      </div>
    );
  }

  return (
    <div className={cls} aria-disabled={disabled || undefined} {...rest}>
      {content}
    </div>
  );
}
