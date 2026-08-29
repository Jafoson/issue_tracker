import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge-safe Auth.js instance (only authConfig, no Prisma adapter/bcrypt).
// Separate from auth.ts so the middleware layer (proxy.ts) doesn't pull any
// Node-only dependencies into the edge bundle.
export const { auth } = NextAuth(authConfig);
