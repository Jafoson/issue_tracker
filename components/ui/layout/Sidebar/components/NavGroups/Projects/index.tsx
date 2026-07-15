"use client"

import { useTranslations } from 'next-intl';
import TabList, { TabGroup } from '../components/TabList'
import { useWorkspace } from '@/lib/workspace-context';
import { ProjectComposer } from '@/features/projects/components/ProjectComposer/ProjectComposer';
import { Button } from '@/components/ui/atoms/Button/Button';
import { Icon } from '@iconify/react';
import styles from "../../../sidebar.module.scss"

export default function NavGroupProjects() {
    const { projects, workspace } = useWorkspace();
    const t = useTranslations();
    const base = `/${workspace.id}`;


    //TODO implement project dashboard tab is active
    function showProjects(){
        const projectTabs: TabGroup[] = [];

        projects.map((p) => {
            const projPath = `${base}/project/${p.slug}`;
            const projectTab:TabGroup = {
                 href: `${projPath}/dashboard`,
                 activeHref: `${projPath}/*`,
                 label: p.name,
                 color: p.color,
                 group: [
                    {
                        href: projPath,
                        label: "Board",
                        icon: "lucide:layout-dashboard",
                    },
                    {
                        href: `${projPath}/list`,
                        label: "Issue",
                        icon: "lucide:list"
                    },
                    {
                        href: `${projPath}/members`,
                        label: "Mitglieder",
                        icon: "lucide:users"
                    },
                    {
                        href: `/settings/project/${p.slug}`,
                        label: "Settings",
                        icon: "lucide:settings"
                    },
                 ]
            }
            projectTabs.push(projectTab)
        })
        return projectTabs
    }

  return (
    <>
    <div className={styles.titleWrapper}>
        <span>
            {t("settings.projects")}
        </span>
        <ProjectComposer
          workspaceId={workspace.id}
          trigger={(open) => (
            <Button variant='text' icon={<Icon icon="lucide:plus" width={15}/>} onClick={open}/>
          )}
        />
    </div>
    <TabList tabs={showProjects()}/>
    </>
  )
}

