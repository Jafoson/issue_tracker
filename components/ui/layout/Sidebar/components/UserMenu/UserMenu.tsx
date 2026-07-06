
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Button } from "@/components/ui/atoms/Button/Button";
import type { AvatarData } from "@/components/ui/atoms/Avatar/Avatar";
import styles from "../../sidebar.module.scss";
import {auth} from "@/auth";

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
    <div className={styles.userRow}>
      <Button
        variant="ghost"
        style={{ gap: 8, flex: "none", minWidth: 0 }}
      >
        <Avatar avatar={me} size={28} />
        <span
          style={{
            display: "block",
            textAlign: "left",
            lineHeight: 1.2,
            minWidth: 0,
          }}
        >
          <span
            style={{
              display: "block",
              fontWeight: 550,
              fontSize: 13,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {me.name}
          </span>
       
        </span>
      </Button>
    </div>
  );
}

