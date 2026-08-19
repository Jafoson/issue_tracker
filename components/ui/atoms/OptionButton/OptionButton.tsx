import { Icon } from "@iconify/react";
import styles from "./optionButton.module.scss";

type OptionButtonVariant = "primary" | "outline";

interface OptionButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  variant?: OptionButtonVariant;
  /** Aus bei einer Zeile, die selbst schon zu einem anderen Ziel führt (nicht
   *  der Fall hier bisher, aber ein einzeiliger Knopf braucht ihn nie). */
  chevron?: boolean;
}

/**
 * Eine Zeile statt eines Knopfes: Icon links, Titel + Untertitel gestapelt,
 * Chevron rechts. Für Anmeldewege, die eine zweite Zeile Erklärung brauchen
 * (Passkey, SSO-Anbieter) — `Button` hat eine feste Höhe pro Größe und damit
 * keinen Platz für eine zweite Zeile.
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
