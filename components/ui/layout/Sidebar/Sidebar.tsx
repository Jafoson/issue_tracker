import { SidebarClient } from "./SidebarClient";

interface SidebarProps {
  onLogout: () => void;
  loggedIn: boolean;
}

export function Sidebar({ onLogout }: SidebarProps) {
  return <SidebarClient onLogout={onLogout} />;
}
