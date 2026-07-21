"use client";
import { Icon } from "@iconify/react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { Button } from "@/components/ui/atoms/Button/Button";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { Label } from "@/components/ui/atoms/Label/Label";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { removeMember, setMemberRole } from "@/features/issues/actions";
import { fullName } from "@/lib/utils/string";
import { useWorkspace } from "@/lib/workspace-context";
import type { Team, User } from "@/types";
import styles from "./members.module.scss";

interface Props {
  members: User[];
  teams: Team[];
}

export function Members({ members, teams }: Props) {
  const { me, roles } = useWorkspace();
  const t = useTranslations();
  const router = useRouter();
  const { workspace } = useParams<{ workspace: string }>();
  const [, startTransition] = useTransition();
  const isAdmin = me.role === "admin" || me.role === "owner";

  const changeRole = (userId: string, role: string) =>
    startTransition(async () => {
      await setMemberRole(workspace, userId, role);
      router.refresh();
    });

  const remove = (userId: string) =>
    startTransition(async () => {
      await removeMember(workspace, userId);
      router.refresh();
    });

  return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>{t("members.title")}</h2>
        {isAdmin && (
          <Button
            variant="primary"
            icon={<Icon icon="lucide:plus" width={15} />}
          >
            {t("actions.inviteMember")}
          </Button>
        )}
      </div>

      <div className={styles.table}>
        <div className={styles.tableHeader}>
          <span>{t("members.colUser")}</span>
          <span>{t("members.colRole")}</span>
          <span>{t("members.colTeams")}</span>
          {isAdmin && <span />}
        </div>
        {members.map((member) => {
          const memberTeams = teams.filter((tm) =>
            tm.members.includes(member.id),
          );
          return (
            <div key={member.id} className={styles.row}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar avatar={member} size={32} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                    {fullName(member)}
                  </div>
                  <div className="faint" style={{ fontSize: 12 }}>
                    {member.email}
                  </div>
                </div>
              </div>

              {isAdmin && member.id !== me.id ? (
                <InlinePicker
                  trigger={
                    <Badge
                      as="button"
                      active={member.role === "admin"}
                      style={{ cursor: "pointer" }}
                    >
                      {member.role}
                    </Badge>
                  }
                  width={200}
                  stop
                >
                  {(close) => (
                    <SelectMenu
                      items={roles.map((r) => ({ value: r.id, label: r.name }))}
                      value={member.role}
                      onPick={(v) => {
                        changeRole(member.id, v as string);
                        close();
                      }}
                      onClose={close}
                    />
                  )}
                </InlinePicker>
              ) : (
                <Badge active={member.role === "admin"}>{member.role}</Badge>
              )}

              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {memberTeams.map((tm) => (
                  <Label key={tm.id} color={tm.color} size="sm">
                    {tm.name}
                  </Label>
                ))}
                {memberTeams.length === 0 && (
                  <span className="faint" style={{ fontSize: 12 }}>
                    {t("members.noTeams")}
                  </span>
                )}
              </div>

              {isAdmin && (
                <button
                  type="button"
                  className="iconbtn"
                  title={t("members.removeTitle")}
                  disabled={member.id === me.id}
                  onClick={() => {
                    if (
                      confirm(
                        `${t("members.removeTitle")} ${fullName(member)}?`,
                      )
                    )
                      remove(member.id);
                  }}
                >
                  <Icon icon="lucide:trash-2" width={15} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
