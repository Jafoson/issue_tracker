"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Popover } from "@/components/ui/atoms/Popover/Popover";
import { useRouter } from "@/i18n/navigation";
import { Workspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import styles from "../SidebarMenu.module.scss";

interface WorkspaceMenuProps {
  workspace: Workspace;
  userWorkspaces: Workspace[]; 
}

export function WorkspaceMenuClient({ workspace, userWorkspaces }: WorkspaceMenuProps) {
  const t = useTranslations("nav");
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  function goTo(wsId: string) {
    setOpen(false);
    router.push(`/${wsId}`);
  }

  return (
    <div ref={ref}>
      <Button variant="ghost" size="lg" onClick={() => setOpen(!open)} style={{ gap: 6, padding: "4px 8px", width: "100%" }}>
        <Avatar avatar={{ name: workspace.name, color: workspace.color }} size={30} />
        <span className={styles.title}>
          {workspace.name}
        </span>
        <Icon
          icon="lucide:chevrons-up-down"
          width={16}
          className={styles.icon}

        />
      </Button>

      <Popover
        anchorRef={ref}
        open={open}
        onClose={() => setOpen(false)}
        width={210}
      >
        <div className={styles.label}>Workspace</div>

        {userWorkspaces.map((ws) => (
          <Button
            key={ws.id}
            variant="ghost"
            full
            textAlign="left"
            className={ws.id === workspace.id ? styles.active : ""}
            onClick={() => goTo(ws.id)}
          >
            <Avatar avatar={{name: ws.name, color: ws.color}}/>
            {ws.name}
          </Button>
        ))}

        <div className="divider" style={{ margin: "5px 0" }} />

        <Button
          variant="elevated"
          full
          onClick={() => {
            setOpen(false);
            router.push("/create-workspace");
          }}
        >
          <Icon icon="lucide:plus" width={16} />
          {t("newWorkspace")}
        </Button>
      </Popover>
    </div>
  );
}
