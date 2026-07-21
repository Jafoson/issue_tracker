import { auth } from "@/auth";
import type { PersonAvatarData } from "@/components/ui/atoms/Avatar/Avatar";
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

  return <UserMenuClient me={me} />;
}
