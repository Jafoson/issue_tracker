import { auth } from "@/auth";
import type { PersonAvatarData } from "@/components/ui/atoms/Avatar/Avatar";
import { getUnreadNotificationCount } from "@/features/notifications/queries";
import { getMyWorkspaces } from "@/features/workspaces/queries";
import { getCurrentWorkspaceId } from "@/lib/current-workspace";
import { db } from "@/lib/db";
import { accountPath, adminPath, workspacePath } from "@/lib/nav";
import { getAccess, PLATFORM } from "@/lib/permissions";
import { resolveAvatarUrl } from "@/lib/storage";
import UserMenuClient from "./UserMenuClient";

export async function UserMenu() {
  const session = await auth();
  let me: PersonAvatarData;

  if (!session?.user) {
    me = { firstName: "", lastName: "", color: "var(--secondary)" };
  } else {
    // `handle` steht nicht im Token (siehe `global.d.ts`) — Name und Kürzel
    // sind beide optional (`features/onboarding`), ein frisches Konto ohne
    // beides braucht den Benutzernamen als einzigen verlässlichen Anzeigewert.
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { handle: true, avatarKey: true },
    });
    me = {
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      color: session.user.color || "var(--primary)",
      handle: user?.handle,
      image: (await resolveAvatarUrl(user?.avatarKey)) ?? undefined,
    };
  }

  // Die eigenen Einstellungen hängen unter einem Workspace — sie brauchen die
  // Hülle drumherum (Seitenleiste, Reiter, Weg zurück), nicht dessen Daten. Im
  // Admin-Bereich gibt es keinen aktiven Workspace; dann führt der Eintrag in
  // den ersten eigenen. Wer in gar keinem ist, bekommt ihn nicht — ein Link ins
  // Leere ist schlechter als kein Link.
  const workspaceId =
    getCurrentWorkspaceId() ?? (await getMyWorkspaces())[0]?.id ?? null;

  const unreadCount = workspaceId
    ? await getUnreadNotificationCount(workspaceId)
    : 0;

  // Der Weg in die Plattformverwaltung — nur für die, die `platform.access`
  // tragen. Für alle anderen gibt es ihn nicht: das Layout unter `/admin`
  // antwortet auf einen Aufruf ohne dieses Recht mit `notFound`, damit die
  // bloße Existenz des Bereichs nicht verrät, wer ihn öffnen darf. Ein
  // sichtbarer Eintrag, der ins Nichts führt, wäre genau diese Verrat-Lücke.
  const access = await getAccess(PLATFORM);
  const adminHref = access.has("platform.access") ? adminPath("") : null;

  return (
    <UserMenuClient
      me={me}
      settingsHref={workspaceId ? accountPath(workspaceId, "") : null}
      inboxHref={workspaceId ? workspacePath(workspaceId, "inbox") : null}
      adminHref={adminHref}
      unreadCount={unreadCount}
    />
  );
}
