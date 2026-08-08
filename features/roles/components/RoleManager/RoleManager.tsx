import { RoleManagerView } from "@/features/roles/components/RoleManagerView/RoleManagerView";
import { getRoleManagerView } from "@/features/roles/queries";
import type { RoleTarget } from "@/features/roles/types";

interface Props {
  target: RoleTarget;
  title: string;
  subtitle: string;
  /** Auf Seiten mit Umschalter steht der Titel schon auf dem Reiter. */
  showTitle?: boolean;
}

/**
 * Server-Teil des Rollen-Editors: lädt den Topf und reicht ihn weiter.
 *
 * Dieselbe Komponente bedient alle drei Scopes — die drei Routen unterscheiden
 * sich nur im `target` und in ihren Texten.
 */
export async function RoleManager({
  target,
  title,
  subtitle,
  showTitle,
}: Props) {
  const view = await getRoleManagerView(target);
  return (
    <RoleManagerView
      view={view}
      title={title}
      subtitle={subtitle}
      showTitle={showTitle}
    />
  );
}
