"use client";

import { Icon } from "@iconify/react";
import { Avatar, type AvatarShape } from "@/components/ui/atoms/Avatar/Avatar";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import styles from "@/components/ui/atoms/Button/button.module.scss";
import { Link, usePathname } from "@/i18n/navigation";
import { isNavActive } from "@/lib/nav";
import navStyles from "./navLink.module.scss";

export interface NavLinkProps {
  href: string;
  icon?: string;
  label: string;
  activeHref?: string;
  badge?: number;
  color?: string;
  /** Hochgeladenes Bild statt des Farbpunkts, z. B. ein Workspace-Avatar. */
  image?: string;
  /** Form des Farbpunkts/Bildes bei `color`. Standard: rund. */
  shape?: AvatarShape;
  onClick?: () => void;
}

/**
 * Eine Zeile in einer Navigation — der gemeinsame Baustein der Seitenleiste und
 * der Einstellungsleisten daneben.
 *
 * Aussehen und Maße kommen vom Knopf (`components/ui/atoms/Button`), markiert
 * wird über `isNavActive` und damit nach derselben Regel wie überall sonst.
 * Zwei Ebenen derselben Navigation sollen sich nicht unterschiedlich anfühlen —
 * deshalb steht diese Zeile hier und nicht in der Seitenleiste.
 */

export function NavLink({
  href,
  icon,
  label,
  activeHref,
  badge,
  color,
  image,
  shape,
  onClick,
}: NavLinkProps) {
  const pathname = usePathname();

  function isActive() {
    return isNavActive(pathname, href, activeHref);
  }
  function LeadingIcon() {
    // Ohne eigenes Icon steht der Eintrag für eine benannte Entität (Projekt,
    // Workspace, ...) statt für eine Route — dieselbe Bild-oder-Initialen-Logik
    // wie überall sonst, wo Entitäten auftauchen (`Avatar`), statt eines
    // undifferenzierten Farbpunkts.
    if (!icon && color) {
      return (
        <Avatar
          avatar={{ name: label, color, image }}
          shape={shape ?? "circle"}
          size={17}
        />
      );
    }
    if (!icon) {
      return <Icon width={17} icon="material-symbols:circle" color={color} />;
    }
    return (
      <Icon icon={icon} width={17} color={color ? color : "currentColor"} />
    );
  }

  return (
    <Link
      href={href}
      className={`${styles.btn} ${styles.ghost} ${styles.md} ${styles.full} ${styles.hasIcon} ${styles["textAlign-left"]} ${styles.link}`}
      data-active={isActive() ? "true" : undefined}
      onClick={onClick}
    >
      <LeadingIcon />
      {/* Der ganze Name bleibt im `title` — die Zeile kürzt ihn nur fürs Auge. */}
      <span className={navStyles.label} title={label}>
        {label}
      </span>
      {badge && <Badge style={{ marginLeft: "auto" }}>{badge}</Badge>}
    </Link>
  );
}
