import { Icon } from "@iconify/react";
import styles from "./chip.module.scss";

type ChipVariant = "text" | "elevated" | "outline";
type ChipType = "assist" | "filter" | "input";

/**
 * `md` ist der Regelfall: ein eigenständiges Bedienelement mit fester Höhe.
 *
 * `inline` steht mitten im Fließtext — eine Erwähnung, ein verlinktes Issue,
 * ein Datum. Der Chip gibt dort seine feste Höhe auf und bemisst sich in `em`,
 * damit er die Zeile nicht auseinanderdrückt und mit dem Text ringsum
 * mitwächst.
 *
 * `lg` steht für sich, nicht in einer Reihe gleichartiger Kacheln — ein
 * einzelner wichtiger Link auf einem Steckbrief zum Beispiel, wo ein
 * `md`-Chip neben Name und Kopfkarte zu klein wirkte.
 */
type ChipSize = "md" | "lg" | "inline";

interface ChipProps extends Omit<React.HTMLAttributes<HTMLElement>, "onClick"> {
  /**
   * Das Wurzelelement. `span`, wo der Chip in einem Absatz steht — ein `div`
   * wäre dort ungültiges HTML und der Browser bräche den Absatz auf.
   */
  as?: "div" | "span";
  variant?: ChipVariant;
  size?: ChipSize;
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
  as: Root = "div",
  variant = "outline",
  size = "md",
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
    styles[size],
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
      <Root
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
      </Root>
    );
  }

  return (
    <Root className={cls} aria-disabled={disabled || undefined} {...rest}>
      {content}
    </Root>
  );
}
