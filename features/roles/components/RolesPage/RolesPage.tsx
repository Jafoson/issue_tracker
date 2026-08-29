"use client";

import { useState } from "react";
import { SegmentedControl } from "@/components/ui/atoms/SegmentedControl/SegmentedControl";
import styles from "./rolesPage.module.scss";

export interface RolesSection {
  id: string;
  label: string;
  /** The already server-rendered `RoleManager` for this pool. */
  node: React.ReactNode;
}

/**
 * Frame of the roles pages: exactly one scroll area, and it belongs to the
 * matrix.
 *
 * A workspace has two role pools (its own and its projects'). Stacked
 * vertically, each matrix would get half the height and its own scrollbar
 * — side-by-side tables don't tolerate that. Hence a switcher: one matrix
 * at a time, at full height.
 *
 * Both sections stay in the tree throughout. They're already loaded
 * anyway, and this way switching survives whatever was set in the hidden
 * matrix (search, open role).
 */
export function RolesPage({ sections }: { sections: RolesSection[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  return (
    <div className={styles.page}>
      {sections.length > 1 && (
        <div className={styles.switcher}>
          <SegmentedControl
            items={sections.map((s) => ({ value: s.id, label: s.label }))}
            value={active}
            onChange={setActive}
          />
        </div>
      )}

      {sections.map((section) => (
        <div
          key={section.id}
          className={styles.section}
          hidden={sections.length > 1 && section.id !== active}
        >
          {section.node}
        </div>
      ))}
    </div>
  );
}
