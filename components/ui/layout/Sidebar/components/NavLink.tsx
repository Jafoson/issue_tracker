import Link from "next/link";
import { Icon } from "@iconify/react";
import { Badge } from "@/components/ui/atoms/Badge/Badge";

interface NavLinkProps {
  href:     string;
  icon:     string;
  label:    string;
  active:   boolean;
  badge?:   number;
  onClick?: () => void;
}

export function NavLink({ href, icon, label, active, badge, onClick }: NavLinkProps) {
  return (
    <Link href={href} className="orbit-nav" data-active={active} onClick={onClick}>
      <Icon icon={icon} width={17} />
      <span>{label}</span>
      {badge && <Badge variant="count" style={{ marginLeft: "auto" }}>{badge}</Badge>}
    </Link>
  );
}
