import { Icon } from "@iconify/react";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { Link } from "@/i18n/navigation";
import styles from "@/components/ui/atoms/Button/button.module.scss"

interface NavLinkProps {
  href: string;
  icon: string;
  label: string;
  active: boolean;
  badge?: number;
  onClick?: () => void;
}

export function NavLink({
  href,
  icon,
  label,
  active,
  badge,
  onClick,
}: NavLinkProps) {
  return (
    <Link
      href={href}
      className={`${styles.btn} ${styles.ghost} ${styles.md} ${styles.full} ${styles.hasIcon} ${styles["textAlign-left"]} ${styles.link}`}
      data-active={active}
      onClick={onClick}
    >
      <Icon icon={icon} width={17} />
      <span>{label}</span>
      {badge && <Badge style={{ marginLeft: "auto" }}>{badge}</Badge>}
    </Link>
  );
}
