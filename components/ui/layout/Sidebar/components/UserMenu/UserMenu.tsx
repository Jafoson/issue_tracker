import type { AvatarData } from "@/components/ui/atoms/Avatar/Avatar";
import {auth} from "@/auth";
import UserMenuClient from "./UserMenuClient";

export async function UserMenu() {
  const session = await auth();
  let me: AvatarData;
  
  if (!session?.user) {
    me = {
      name: "Unknown User",
      color: "var(--secondary)",
    };
  }
  else {
    me = {
      name: session.user.name || "Unknown User",
      color: session.user.color || "var(--primary)",
    };
  }

  return (
    <UserMenuClient me={me} />
  );
}

