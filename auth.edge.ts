import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge-sichere Auth.js-Instanz (nur authConfig, kein Prisma-Adapter/bcrypt).
// Getrennt von auth.ts, damit der Middleware-Layer (proxy.ts) keine Node-only
// Abhängigkeiten in das Edge-Bundle zieht.
export const { auth } = NextAuth(authConfig);
