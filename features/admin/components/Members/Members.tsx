"use client";
import { Icon } from "@iconify/react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Button } from "@/components/ui/atoms/Button/Button";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { Label } from "@/components/ui/atoms/Label/Label";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { removeMember, setMemberRole } from "@/features/workspaces/actions";
import { useModal } from "@/lib/context";
import { roleColor } from "@/lib/rbac";
import { fullName } from "@/lib/utils/string";
import type { Role, Team, User } from "@/types";
import { InviteMemberModal } from "./components/InviteMemberModal";
import styles from "./members.module.scss";

/**
 * Was der eingeloggte Benutzer hier darf. Entscheidet der Server anhand der
 * Permissions — die Oberfläche kennt keine Rollennamen mehr. Die drei Rechte
 * sind bewusst getrennt: eine Rolle darf Mitglieder einladen, ohne Rollen
 * vergeben zu dürfen.
 */
interface MemberAbilities {
  invite: boolean;
  setRole: boolean;
  remove: boolean;
}

interface Props {
  members: User[];
  teams: Team[];
  me: User;
  roles: Role[];
  can: MemberAbilities;
}

export function Members({ members, teams, me, roles, can }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const { workspace } = useParams<{ workspace: string }>();
  const { openModal } = useModal();
  const [, startTransition] = useTransition();

  // Vergeben lässt sich nur, was unter dem eigenen Rang liegt — dieselbe Grenze
  // wie beim Ändern einer Rolle in der Tabelle. `owner` steht nie darin: den gibt
  // es nur per Ownership-Transfer.
  const assignableRoles = roles.filter(
    (r) => r.id !== "owner" && r.rank <= (me.roleRank ?? -1),
  );

  const openInvite = () =>
    openModal(({ close }) => (
      <InviteMemberModal
        workspaceId={workspace}
        roles={assignableRoles}
        close={close}
      />
    ));

  const roleName = (key: string | undefined) =>
    roles.find((r) => r.id === key)?.name ?? key ?? "";

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
        {can.invite && assignableRoles.length > 0 && (
          <Button
            variant="primary"
            icon={<Icon icon="lucide:plus" width={15} />}
            onClick={openInvite}
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
          {(can.setRole || can.remove) && <span />}
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

              {can.setRole && member.id !== me.id ? (
                <InlinePicker
                  trigger={
                    <Label
                      size="sm"
                      filled
                      color={roleColor(member.roleRank ?? -1)}
                      style={{ cursor: "pointer" }}
                    >
                      {roleName(member.role)}
                    </Label>
                  }
                  width={200}
                  stop
                >
                  {(close) => (
                    <SelectMenu
                      items={roles.map((r) => ({ value: r.id, label: r.name }))}
                      value={member.role ?? null}
                      onPick={(v) => {
                        changeRole(member.id, v as string);
                        close();
                      }}
                      onClose={close}
                    />
                  )}
                </InlinePicker>
              ) : (
                <Label
                  size="sm"
                  filled
                  color={roleColor(member.roleRank ?? -1)}
                >
                  {roleName(member.role)}
                </Label>
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

              {can.remove && (
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
