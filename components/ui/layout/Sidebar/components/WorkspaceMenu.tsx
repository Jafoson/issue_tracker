"use client";
import { useTranslations } from "@/lib/translations-context";

import { useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { Popover } from "@/components/ui/atoms/Popover/Popover";



interface WorkspaceMenuProps {
  onLogout: () => void;
}

export function WorkspaceMenu({ onLogout }: WorkspaceMenuProps) {

  const t = useTranslations();
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button ref={ref} className="orbit-ws" onClick={() => setOpen((o) => !o)}>
        <span className="avatar" style={{ width: 26, height: 26, borderRadius: 8, background: "linear-gradient(150deg,#6e63e6,#473fb0)", fontSize: 12.5 }}>N</span>
        <div style={{ textAlign: "left", lineHeight: 1.15, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Orbit</div>
          <div className="faint" style={{ fontSize: 11 }} />
        </div>
        <Icon icon="lucide:chevrons-up-down" width={15} className="faint" style={{ marginLeft: "auto" }} />
      </button>

      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={236}>
        <div className="menu-label">Workspace</div>
        <div className="menu-item active">
          <span className="avatar" style={{ width: 22, height: 22, borderRadius: 7, background: "linear-gradient(150deg,#6e63e6,#473fb0)", fontSize: 11 }}>N</span>
          Orbit<span className="check"><Icon icon="lucide:check" width={15} /></span>
        </div>
        <div className="divider" style={{ margin: "5px 0" }} />
        <div className="menu-item"><Icon icon="lucide:plus" width={16} className="faint" /> {t.nav.newWorkspace}</div>
        <div className="menu-item" onClick={onLogout}><Icon icon="lucide:log-out" width={16} className="faint" /> {t.nav.signOut}</div>
      </Popover>
    </>
  );
}
