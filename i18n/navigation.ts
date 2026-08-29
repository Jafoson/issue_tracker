import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware navigation APIs: automatically add the active locale prefix,
// so no manual `/${locale}/…` is needed anymore.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
