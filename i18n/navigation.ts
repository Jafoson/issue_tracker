import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-bewusste Navigations-APIs: fügen automatisch das aktive Locale-Präfix hinzu,
// daher kein manuelles `/${locale}/…` mehr nötig.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
