"use client"

import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { Link, usePathname } from "@/i18n/navigation";
import styles from "@/components/ui/atoms/Button/button.module.scss"
import { Icon } from "@iconify/react";

export interface NavLinkProps {
  href: string;
  icon?: string;
  label: string;
  activeHref?: string;
  badge?: number;
  color?: string;
  onClick?: () => void;
}

export function NavLink({
  href,
  icon,
  label,
  activeHref,
  badge,
  color,
  onClick,
}: NavLinkProps) {
  const pathname = usePathname();

  function isActive (){
    if (activeHref){
      return pathname === activeHref
    }
    return pathname === href

  }
  function LeadingIcon(){
    if (!icon){
      return <Icon width={17} icon="material-symbols:circle" color={color}/>
    }
    return <Icon icon={icon} width={17} color={color? color: "currentColor"}/>
  }

  return (
    <Link
      href={href}
      className={`${styles.btn} ${styles.ghost} ${styles.md} ${styles.full} ${styles.hasIcon} ${styles["textAlign-left"]} ${styles.link}`}
      data-active={isActive() ? "true" : undefined}
      onClick={onClick}
    >
      <LeadingIcon/>
      <span>{label}</span>
      {badge && <Badge style={{ marginLeft: "auto" }}>{badge}</Badge>}
    </Link>
  );
}
