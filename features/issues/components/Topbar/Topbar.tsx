import { Suspense } from "react";
import { TopbarClient } from "./TopbarClient";

/** Filter/sort/view bar above the issue board and list. */
export function Topbar() {
  return (
    <Suspense>
      <TopbarClient />
    </Suspense>
  );
}
