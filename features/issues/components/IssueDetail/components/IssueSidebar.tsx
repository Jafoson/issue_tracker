"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Resizer } from "@/components/ui/layout/Resizer/Resizer";
import type { IssueComposerData, IssuePatch } from "@/features/issues/types";
import type { IssueDetail } from "@/types";
import styles from "../issueDetail.module.scss";
import { IssueLabels } from "./IssueLabels";
import { IssueMeta } from "./IssueMeta";
import { IssueProperties } from "./IssueProperties";

interface IssueSidebarProps {
  issue: IssueDetail;
  data: IssueComposerData;
  /**
   * Ausgangsbreite in px. Die Vollseite gibt eine größere vor als der Dialog —
   * dort ist der Platz da, und die Werte stehen sonst enger als nötig.
   */
  defaultWidth?: number;
  onPatch: (patch: IssuePatch) => void;
}

/**
 * Grenzen der Attributspalte. Darunter passen die Werte neben ihre
 * Beschriftung nicht mehr, darüber nimmt sie dem Text zu viel weg. Zusätzlich
 * deckelt `.sidebar` sie in CSS auf die halbe Breite — auf einem schmalen
 * Dialog wären selbst 520px zu viel.
 */
const MIN_W = 220;
const MAX_W = 520;
/** Ausgangsbreite im Dialog. Entspricht `--detail-sidebar-w` in `.detail`. */
const DEFAULT_W = 300;
/** Ausgangsbreite auf der Vollseite. Entspricht `--detail-sidebar-w` in `.page`. */
export const PAGE_SIDEBAR_W = 380;

/**
 * Die Attributspalte der zweispaltigen Ansicht — dieselben drei Blöcke, die im
 * Seitenpanel untereinander in der Spalte stehen, hier nur neben dem Inhalt
 * und in ihrer schmalen Form (`layout="aside"`).
 *
 * Oben, was man ändert (Typ, Status, Priorität, Zuständigkeit, Labels), unten,
 * was feststeht. Wie breit sie dabei ist, entscheidet der Griff an ihrer
 * linken Kante. Die gezogene Breite gilt für die geöffnete Ansicht und fängt
 * beim nächsten Öffnen wieder bei der Ausgangsbreite an.
 */
export function IssueSidebar({
  issue,
  data,
  defaultWidth = DEFAULT_W,
  onPatch,
}: IssueSidebarProps) {
  const t = useTranslations();
  const [width, setWidth] = useState(defaultWidth);

  return (
    <>
      {/* Ein eigenes Element zwischen den Spalten statt eines Rands an der
          Spalte selbst: nur so reicht die Trefferfläche über die volle Höhe
          und scrollt nicht mit dem Inhalt weg. */}
      <Resizer
        className={styles.sidebarResizer}
        width={width}
        onChange={setWidth}
        min={MIN_W}
        max={MAX_W}
        reset={defaultWidth}
        label={t("actions.resizeSidebar")}
      />

      <aside
        className={styles.sidebar}
        // Gezogener Wert — er kann nur hier stehen. Die Ausgangsbreite kommt
        // weiterhin aus der Stylesheet-Datei.
        style={{ "--detail-sidebar-w": `${width}px` } as React.CSSProperties}
      >
        <IssueProperties
          issue={issue}
          data={data}
          layout="aside"
          onPatch={onPatch}
        />

        <div className={styles.divider} />

        <IssueLabels
          issue={issue}
          data={data}
          layout="aside"
          onPatch={onPatch}
        />

        <div className={styles.divider} />

        <IssueMeta issue={issue} data={data} layout="aside" />
      </aside>
    </>
  );
}
