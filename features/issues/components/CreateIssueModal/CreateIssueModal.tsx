"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { Button } from "@/components/ui/atoms/Button/Button";
import { FilterChip } from "@/components/ui/atoms/FilterChip/FilterChip";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import {
  ModalTextarea,
  ModalTitleInput,
} from "@/components/ui/layout/Modal/components/ModalFields";
import {
  ModalFooter,
  ModalShortcut,
} from "@/components/ui/layout/Modal/components/ModalFooter";
import { ModalHeader } from "@/components/ui/layout/Modal/components/ModalHeader";
import {
  Modal,
  ModalBody,
  ModalToolbar,
} from "@/components/ui/layout/Modal/Modal";
import { createIssue } from "@/features/issues/actions";
import {
  LabelDots,
  LabelIcon,
  PriorityIcon,
  StatusIcon,
  TypeIcon,
} from "@/features/issues/components/IssueIcons/IssueIcons";
import { LabelPickerMenu } from "@/features/issues/components/LabelPickerMenu/LabelPickerMenu";
import { fullName } from "@/lib/utils/string";
import { useSubmitShortcut } from "@/lib/utils/useSubmitShortcut";
import { useWorkspace } from "@/lib/workspace-context";
import type { Label } from "@/types";

interface CreateIssueModalProps {
  projectId: string;
  initialStatus: string;
  close: () => void;
}

export function CreateIssueModal({
  projectId,
  initialStatus,
  close,
}: CreateIssueModalProps) {
  const {
    members,
    projects,
    labels: allLabels,
    statuses,
    priorities,
    issueTypes,
    me,
    workspace,
  } = useWorkspace();
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const project = projects.find((p) => p.id === projectId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [priority, setPriority] = useState(0);
  const [type, setType] = useState(issueTypes[0]?.id ?? "feature");
  const [assignee, setAssignee] = useState<string | null>(null);
  const [labels, setLabels] = useState<string[]>([]);
  const [localLabels, setLocalLabels] = useState<Label[]>([]);

  const combinedLabels = [
    ...allLabels,
    ...localLabels.filter((l) => !allLabels.some((a) => a.id === l.id)),
  ];
  const assigneeUser = assignee
    ? (members.find((m) => m.id === assignee) ?? null)
    : null;

  const statusName = (id: string) =>
    statuses.find((s) => s.id === id)?.name ?? id;
  const priorityName = (id: number) =>
    priorities.find((p) => p.id === id)?.name ?? String(id);
  const typeName = (id: string) =>
    issueTypes.find((x) => x.id === id)?.name ?? id;

  const submit = () => {
    if (!title.trim() || !project) return;
    startTransition(async () => {
      await createIssue({
        title: title.trim(),
        description,
        status,
        priority,
        assignee,
        labels,
        type,
        projectId: project.id,
        reporterId: me.id,
      });
      router.refresh();
      close();
    });
  };

  useSubmitShortcut(submit);

  if (!project) return null;

  const selectedLabelObjects = labels
    .map((id) => combinedLabels.find((l) => l.id === id))
    .filter(Boolean) as Label[];

  const labelName = t("fields.label");
  const labelLabel =
    labels.length === 0
      ? labelName
      : labels.length === 1
        ? (selectedLabelObjects[0]?.name ?? labelName)
        : t("filters.labels", { count: labels.length });
  const labelIcon =
    selectedLabelObjects.length === 0 ? (
      <Icon icon="lucide:tag" width={13} />
    ) : selectedLabelObjects.length === 1 ? (
      <LabelIcon color={selectedLabelObjects[0].color} size={13} />
    ) : (
      <LabelDots labels={selectedLabelObjects} />
    );

  return (
    <Modal>
      <ModalHeader
        leading={
          <Badge>
            <span className="dot" style={{ background: project.color }} />
            {project.prefix}
          </Badge>
        }
        title={t("actions.newIssue")}
        onClose={close}
        closeLabel={t("actions.close")}
      />

      <ModalBody>
        {/* Der Fokus gehört beim Öffnen ins Titelfeld — der ModalFrame
            respektiert das und greift dann nicht mehr auf das Panel zu. */}
        <ModalTitleInput
          autoFocus
          placeholder={t("placeholders.issueTitle")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        <ModalTextarea
          placeholder={t("placeholders.addDescription")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />
      </ModalBody>

      {/* Typ, Status und Priorität sind Pflichtfelder — sie tragen immer einen
          Wert, bleiben deshalb neutral und bekommen keinen Clear-Button.
          Assignee und Labels sind optional und heben sich hervor, sobald sie
          gesetzt sind. */}
      <ModalToolbar>
        <FilterChip
          name={t("fields.type")}
          label={typeName(type)}
          icon={<TypeIcon type={type} size={14} />}
          active={false}
          width={190}
        >
          {(closeMenu) => (
            <SelectMenu
              items={issueTypes.map((x) => ({
                value: x.id,
                label: x.name,
                icon: <TypeIcon type={x.id} size={15} />,
              }))}
              value={type}
              onPick={(v) => {
                setType(v as string);
                closeMenu();
              }}
              onClose={closeMenu}
            />
          )}
        </FilterChip>

        <FilterChip
          name={t("fields.status")}
          label={statusName(status)}
          icon={<StatusIcon status={status} size={14} />}
          active={false}
          width={200}
        >
          {(closeMenu) => (
            <SelectMenu
              items={statuses.map((s) => ({
                value: s.id,
                label: statusName(s.id),
                icon: <StatusIcon status={s.id} size={15} />,
              }))}
              value={status}
              onPick={(v) => {
                setStatus(v as string);
                closeMenu();
              }}
              onClose={closeMenu}
            />
          )}
        </FilterChip>

        <FilterChip
          name={t("fields.priority")}
          label={priorityName(priority)}
          icon={<PriorityIcon priority={priority} size={14} />}
          active={false}
          width={190}
        >
          {(closeMenu) => (
            <SelectMenu
              items={priorities.map((p) => ({
                value: p.id,
                label: priorityName(p.id),
                icon: <PriorityIcon priority={p.id} size={15} />,
              }))}
              value={priority}
              onPick={(v) => {
                setPriority(v as number);
                closeMenu();
              }}
              onClose={closeMenu}
            />
          )}
        </FilterChip>

        <FilterChip
          name={t("fields.assignee")}
          label={assigneeUser ? assigneeUser.firstName : t("fields.assignee")}
          icon={
            assigneeUser ? (
              <Avatar avatar={assigneeUser} size={15} />
            ) : (
              <Icon icon="lucide:circle-dashed" width={14} />
            )
          }
          active={!!assigneeUser}
          onClear={() => setAssignee(null)}
          width={220}
        >
          {(closeMenu) => (
            <SelectMenu
              items={[
                {
                  value: null,
                  label: t("fields.unassigned"),
                  icon: <Avatar avatar={null} size={18} />,
                },
                ...members.map((u) => ({
                  value: u.id,
                  label: fullName(u),
                  icon: <Avatar avatar={u} size={18} />,
                })),
              ]}
              value={assignee}
              onPick={(v) => {
                setAssignee(v as string | null);
                closeMenu();
              }}
              onClose={closeMenu}
              searchable
            />
          )}
        </FilterChip>

        <FilterChip
          name={labelName}
          label={labelLabel}
          icon={labelIcon}
          active={labels.length > 0}
          onClear={() => setLabels([])}
          maxWidth={320}
        >
          {(closeMenu) => (
            <LabelPickerMenu
              allLabels={combinedLabels}
              selected={labels}
              projectId={project.id}
              projectName={project.name}
              workspaceId={workspace.id}
              onPick={(id) =>
                setLabels((cur) =>
                  cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
                )
              }
              onCreated={(label) => setLocalLabels((cur) => [...cur, label])}
              onClose={closeMenu}
              keepOpen
            />
          )}
        </FilterChip>
      </ModalToolbar>

      <ModalFooter
        hint={
          <ModalShortcut keys={["⌘", "↵"]}>
            {t("issues.toCreate")}
          </ModalShortcut>
        }
      >
        <Button variant="ghost" onClick={close}>
          {t("actions.cancel")}
        </Button>
        <Button
          variant="primary"
          disabled={!title.trim() || isPending}
          onClick={submit}
        >
          {t("actions.createIssue")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
