"use client";

import { Icon } from "@iconify/react";
import { useRef, useState } from "react";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Popover } from "@/components/ui/atoms/Popover/Popover";
import { NavLink } from "@/components/ui/layout/NavLink/NavLink";
import styles from "./settingsNav.module.scss";

export interface SettingsNavSubject {
  id: string;
  name: string;
  color: string;
  /** Uploaded image instead of the color dot, e.g. a workspace avatar. */
  image?: string;
  /** The equivalent section on the sibling — usually its General page. */
  href: string;
  /**
   * Heading under which the row sits — for projects, the workspace they
   * live in. Without one, the list appears ungrouped. Grouping follows
   * order, not collection: the list arrives already sorted.
   */
  group?: string;
}

interface Props {
  /** Whose settings are currently open — only for the trigger's own display. */
  name: string;
  color: string;
  /** Uploaded image instead of the color dot in the trigger. */
  image?: string;
  /**
   * Where you can jump to from here, including the currently open entry.
   * Already filtered: the layout only passes along what the user is
   * allowed to see.
   */
  siblings: SettingsNavSubject[];
  /** Heading above the list, e.g. "Project". */
  label: string;
}

/**
 * The settings nav's header as a switcher — the same as the workspace
 * switcher in the sidebar, just one level deeper and with the goal of
 * staying within the same section.
 *
 * Whoever has a project's settings open usually wants to get from there to
 * another project's settings, not to its board; the path via sidebar,
 * project, settings is three clicks for one switch. That's why the rows
 * here lead to `…/settings` rather than the sibling's home page.
 *
 * The rows are `NavLink`s like everywhere else in the navigation: real
 * links (middle-click, new tab) and the same marking of the open entry
 * following the same rule. The trigger is a button, because it doesn't
 * lead anywhere — it only expands.
 */
export function SettingsSubjectMenu({
  name,
  color,
  image,
  siblings,
  label,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <div ref={ref} className={styles.switcher}>
      <Button
        variant="ghost"
        full
        textAlign="left"
        className={styles.trigger}
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar avatar={{ name, color, image }} shape="square" size={20} />
        <span className={styles.subject} title={name}>
          {name}
        </span>
        <Icon
          icon="lucide:chevrons-up-down"
          width={14}
          className={styles.chevron}
        />
      </Button>

      <Popover
        anchorRef={ref}
        open={open}
        onClose={() => setOpen(false)}
        width={228}
      >
        {/* When the selection spans across workspaces, it grows long. The
            `Popover` knows nothing about height — it only repositions
            itself to fit on screen. So the list caps itself here. */}
        <div className={styles.menuList}>
          {siblings.map((item, i) => {
            // The heading sits wherever the group changes. Without groups,
            // it stays at the single one at the top that states what this
            // is a selection of.
            const heading =
              item.group && item.group !== siblings[i - 1]?.group
                ? item.group
                : i === 0
                  ? label
                  : null;

            return (
              <div key={item.id}>
                {heading && <p className={styles.menuLabel}>{heading}</p>}
                <NavLink
                  href={item.href}
                  label={item.name}
                  color={item.color}
                  image={item.image}
                  onClick={() => setOpen(false)}
                />
              </div>
            );
          })}
        </div>
      </Popover>
    </div>
  );
}
