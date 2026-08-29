import { Icon } from "@iconify/react";
import styles from "./optionButton.module.scss";

type OptionButtonVariant = "primary" | "outline";

interface OptionButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  variant?: OptionButtonVariant;
  /** Off for a row that already leads to another destination on its own (not
   *  the case here so far, but a single-line button never needs it). */
  chevron?: boolean;
}

/**
 * A row instead of a button: icon on the left, title + subtitle stacked,
 * chevron on the right. For sign-in methods that need a second line of
 * explanation (passkey, SSO provider) — `Button` has a fixed height per
 * size and thus no room for a second line.
 */
export function OptionButton({
  icon,
  title,
  subtitle,
  variant = "outline",
  chevron = true,
  type = "button",
  className,
  ...rest
}: OptionButtonProps) {
  return (
    <button
      type={type}
      className={[styles.row, styles[variant], className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      <span className={styles.icon}>{icon}</span>
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </span>
      {chevron && (
        <Icon
          icon="lucide:chevron-right"
          width={16}
          className={styles.chevron}
        />
      )}
    </button>
  );
}
