"use client";

import { useState } from "react";
import { SegmentedControl } from "@/components/ui/atoms/SegmentedControl/SegmentedControl";
import styles from "./rolesPage.module.scss";

export interface RolesSection {
  id: string;
  label: string;
  /** Der fertig server-gerenderte `RoleManager` dieses Topfes. */
  node: React.ReactNode;
}

/**
 * Rahmen der Rollen-Seiten: genau ein Scroll-Bereich, und der gehört der Matrix.
 *
 * Ein Workspace hat zwei Rollentöpfe (seine eigenen und die seiner Projekte).
 * Untereinander gestellt bekäme jede Matrix die halbe Höhe und einen eigenen
 * Scrollbalken — nebeneinander gelegte Tabellen vertragen das nicht. Deshalb ein
 * Umschalter: eine Matrix zur Zeit, über die volle Höhe.
 *
 * Beide Abschnitte bleiben dabei im Baum. Sie sind ohnehin schon geladen, und so
 * überlebt der Wechsel, was in der versteckten Matrix eingestellt war (Suche,
 * offene Rolle).
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
