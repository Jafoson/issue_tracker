import { Suspense } from "react";
import { TopbarClient } from "./TopbarClient";

interface TopbarProps {
  /** Issues in the current view — already narrowed by the active filters. */
  count: number;
}

/** Title, issue count, search, filter/sort/view bar above the board and list. */
export function Topbar({ count }: TopbarProps) {
  return (
    <Suspense>
      <TopbarClient count={count} />
    </Suspense>
  );
}
