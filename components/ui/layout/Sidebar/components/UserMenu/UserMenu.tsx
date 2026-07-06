
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Button } from "@/components/ui/atoms/Button/Button";;
import styles from "../../sidebar.module.scss";
import {useSession} from "next-auth/react";

export function UserMenu() {
  const { data: session } = useSession();
  const me = session?.user;

  return (
    <div className={styles.userRow}>
      <Button
        variant="ghost"
        style={{ gap: 8, flex: "none", minWidth: 0 }}
      >
        <Avatar user={me} size={28} />
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
