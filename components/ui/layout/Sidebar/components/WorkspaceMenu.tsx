"use client";

import { Icon } from "@iconify/react";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Popover } from "@/components/ui/atoms/Popover/Popover";
import { useTranslations } from "@/lib/translations-context";
import { useWorkspace } from "@/lib/workspace-context";

export function WorkspaceMenu() {
  const { workspace, userWorkspaces } = useWorkspace();
  const t = useTranslations();
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  function goTo(wsId: string) {
    setOpen(false);
    router.push(`/${locale}/${wsId}`);
  }

  function initial(name: string) {
    return name.trim()[0]?.toUpperCase() ?? "W";
  }

  return (
    <>
      <button
        ref={ref}
        type="button"
        className="orbit-ws"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span
          className="avatar"
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            background: workspace.color,
            fontSize: 12.5,
          }}
        >
          {initial(workspace.name)}
        </span>
        <div style={{ textAlign: "left", lineHeight: 1.15, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 13.5,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {workspace.name}
          </div>
        </div>
        <Icon
          icon="lucide:chevrons-up-down"
          width={15}
          className="faint"
          style={{ marginLeft: "auto" }}
        />
      </button>

      <Popover
        anchorRef={ref}
        open={open}
        onClose={() => setOpen(false)}
        width={236}
      >
        <div className="menu-label">Workspace</div>

        {userWorkspaces.map((ws) => (
          <button
            type="button"
            key={ws.id}
            className={`menu-item${ws.id === workspace.id ? " active" : ""}`}
            onClick={() => goTo(ws.id)}
          >
            <span
              className="avatar"
              style={{
                width: 22,
                height: 22,
                borderRadius: 7,
                background: ws.color,
                fontSize: 11,
              }}
            >
              {initial(ws.name)}
            </span>
            {ws.name}
            {ws.id === workspace.id && (
              <span className="check">
                <Icon icon="lucide:check" width={15} />
              </span>
            )}
          </button>
        ))}

        <div className="divider" style={{ margin: "5px 0" }} />

        <button
          type="button"
          className="menu-item"
          onClick={() => {
            setOpen(false);
            router.push(`/${locale}/create-workspace`);
          }}
        >
          <Icon icon="lucide:plus" width={16} className="faint" />
          {t.nav.newWorkspace}
        </button>
      </Popover>
    </>
  );
}
