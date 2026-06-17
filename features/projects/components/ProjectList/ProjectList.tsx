import Link from "next/link";
import { Icon } from "@iconify/react";
import { AvatarStack } from "@/components/ui/atoms/Avatar/Avatar";
import { toProjectSlug } from "@/lib/slug";
import type { ProjectWithStats } from "@/features/projects/queries";
import type { User } from "@/types";
import styles from "./projectList.module.scss";

interface Props {
  projects: ProjectWithStats[];
  members: User[];
  base: string;
}

export function ProjectList({ projects, members, base }: Props) {
  const memberIds = members.map((m) => m.id);

  return (
    <div className={styles.wrap}>
      <h2 className={styles.pageTitle}>Projects</h2>

      <div className={styles.table}>
        <div className={styles.header}>
          <span>Name</span>
          <span>Members</span>
          <span>Issues</span>
        </div>

        {projects.map((project) => (
          <Link
            key={project.id}
            href={`${base}/project/${toProjectSlug(project.name)}`}
            className={styles.row}
          >
            <span className={styles.nameCell}>
              <span className="dot" style={{ background: project.color, width: 11, height: 11, flexShrink: 0 }} />
              <span className={styles.name}>{project.name}</span>
              <span className={`${styles.prefix} faint mono`}>{project.prefix}</span>
            </span>

            <span className={styles.membersCell}>
              <AvatarStack ids={memberIds} users={members} size={22} max={4} />
            </span>

            <span className={styles.issuesCell}>
              <Icon icon="lucide:circle-dot" width={14} className="faint" />
              <span>{project.issueCount}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
