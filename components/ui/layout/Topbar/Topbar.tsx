import { Suspense } from "react";
import { TopbarClient } from "./TopbarClient";

export function Topbar() {
  return (
    <Suspense>
      <TopbarClient />
    </Suspense>
  );
}
