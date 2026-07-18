"use client";

import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { ProjectComposer } from "@/features/projects/components/ProjectComposer/ProjectComposer";

// Eigene Client-Komponente, weil `trigger` eine Render-Prop ist und Funktionen
// nicht über die Server/Client-Grenze serialisierbar sind.
export function AddProjectButton({ workspaceId }: { workspaceId: string }) {
  return (
    <ProjectComposer
      workspaceId={workspaceId}
      trigger={(open) => (
        <Button
          variant="text"
          icon={<Icon icon="lucide:plus" width={15} />}
          onClick={open}
        />
      )}
    />
  );
}
