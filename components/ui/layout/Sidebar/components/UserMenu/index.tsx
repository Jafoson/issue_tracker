import { auth } from "@/auth";
import type { PersonAvatarData } from "@/components/ui/atoms/Avatar/Avatar";
import { getMyWorkspaces } from "@/features/workspaces/queries";
import { getCurrentWorkspaceId } from "@/lib/current-workspace";
import { accountPath } from "@/lib/nav";
import UserMenuClient from "./UserMenuClient";

//TODO add Notification logic and add this in Badge

export async function UserMenu() {
  const session = await auth();
  let me: PersonAvatarData;

  if (!session?.user) {
    me = {
      firstName: "Unknown",
      lastName: "User",
      color: "var(--secondary)",
    };
  } else {
    me = {
      firstName: session.user.firstName || "Unknown",
      lastName: session.user.lastName || "User",
      color: session.user.color || "var(--primary)",
    };
  }

  // Die eigenen Einstellungen hängen unter einem Workspace — sie brauchen die
  // Hülle drumherum (Seitenleiste, Reiter, Weg zurück), nicht dessen Daten. Im
  // Admin-Bereich gibt es keinen aktiven Workspace; dann führt der Eintrag in
  // den ersten eigenen. Wer in gar keinem ist, bekommt ihn nicht — ein Link ins
  // Leere ist schlechter als kein Link.
  const workspaceId =
    getCurrentWorkspaceId() ?? (await getMyWorkspaces())[0]?.id ?? null;

  return (
    <UserMenuClient
      me={me}
      settingsHref={workspaceId ? accountPath(workspaceId, "") : null}
    />
  );
}
