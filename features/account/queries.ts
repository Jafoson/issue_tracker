import "server-only";
import { cache } from "react";
import { enabledOAuthProviders, oidcProviderName } from "@/auth.config";
import type {
  AccountConnectionsView,
  AccountProfileView,
  AccountSecurityView,
  Preferences,
} from "@/features/account/types";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

// Alles hier gilt genau einer Person: der eingeloggten. Es gibt keinen Parameter
// „welcher Benutzer" — wer fremde Konten läse, hätte damit eine Möglichkeit
// geschaffen, die es nicht geben soll. `null` heißt wie überall „gibt es für
// dich nicht", und die Seiten machen daraus ein 404.
//
// Über `cache()` pro Request dedupliziert, wie in `features/workspaces/queries`.

/**
 * Die Anbieter, die dieses Konto kennen kann — unabhängig davon, ob sie hier
 * konfiguriert sind.
 *
 * Steht als feste Liste da und nicht als das, was `auth.config.ts` gerade
 * aktiviert: die Seite zeigt auch den nicht eingerichteten Anbieter, dann aber
 * ohne Knopf. Sonst hinge die Existenz einer Zeile an einer Umgebungsvariablen,
 * und niemand könnte sehen, dass es die Möglichkeit überhaupt gibt.
 */
export const OAUTH_PROVIDERS = ["github", "google"] as const;

/** OIDC ist nicht Teil der festen Liste oben — sein Name kommt erst aus
 *  `AUTH_OIDC_NAME`, es gibt also nichts Sinnvolles anzuzeigen, solange er
 *  nicht konfiguriert ist. */
export const OIDC_PROVIDER_ID = "oidc";

/** Was gilt, solange niemand etwas eingestellt hat. Dieselben Werte wie die
 *  `@default`s in `prisma/schema.prisma`. */
export const DEFAULT_PREFERENCES: Preferences = {
  theme: "dark",
  adminNoticeHidden: false,
  assignedInApp: true,
  assignedEmail: true,
  mentionedInApp: true,
  mentionedEmail: true,
  commentInApp: true,
  commentEmail: false,
  statusInApp: true,
  statusEmail: false,
  inviteInApp: true,
  inviteEmail: true,
  roleInApp: true,
  roleEmail: true,
  issueSharedInApp: true,
  issueSharedEmail: true,
};

/**
 * Die eigenen Vorlieben — für jeden Eingeloggten, auch ohne Zeile in der
 * Tabelle.
 *
 * Sie entsteht erst beim ersten Speichern. Wer nie etwas eingestellt hat,
 * bekommt hier die Vorgaben; die Oberfläche muss den Unterschied nicht kennen
 * und hat nie einen leeren Zustand darzustellen.
 */
export const getMyPreferences = cache(async (): Promise<Preferences> => {
  const session = await getSession();
  if (!session) return DEFAULT_PREFERENCES;

  const row = await db.userPreferences.findUnique({
    where: { userId: session.userId },
  });
  if (!row) return DEFAULT_PREFERENCES;

  // Alles, was keine Benachrichtigung ist, wird einzeln herausgenommen — was
  // übrig bleibt, sind genau die Schalter aus `NotificationSettings`. Eine neue
  // Spalte, die hier nicht steht, landete sonst stillschweigend darin.
  const { userId: _userId, theme, adminNoticeHidden, ...notifications } = row;
  return {
    ...notifications,
    theme: theme as Preferences["theme"],
    adminNoticeHidden,
  };
});

/** Stammdaten des eigenen Kontos. */
export const getMyProfile = cache(
  async (): Promise<AccountProfileView | null> => {
    const session = await getSession();
    if (!session) return null;

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        handle: true,
        email: true,
        color: true,
        emailVerified: true,
      },
    });
    if (!user) return null;

    return { ...user, emailVerified: user.emailVerified !== null };
  },
);

/** Womit man sich anmeldet: Passkeys, Adresse, fremde Anbieter. */
export const getMySecurity = cache(
  async (): Promise<AccountSecurityView | null> => {
    const session = await getSession();
    if (!session) return null;

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        email: true,
        emailVerified: true,
        accounts: { select: { provider: true } },
        authenticators: {
          select: {
            credentialID: true,
            credentialDeviceType: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!user) return null;

    return {
      email: user.email,
      emailVerified: user.emailVerified !== null,
      connectedProviders: user.accounts.map((a) => a.provider),
      passkeys: user.authenticators.map((a) => ({
        credentialID: a.credentialID,
        deviceType: a.credentialDeviceType,
        createdAt: a.createdAt,
      })),
    };
  },
);

/** Die fremden Anmeldewege dieses Kontos. */
export const getMyConnections = cache(
  async (): Promise<AccountConnectionsView | null> => {
    const session = await getSession();
    if (!session) return null;

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        accounts: { select: { provider: true } },
        authenticators: { select: { credentialID: true } },
      },
    });
    if (!user) return null;

    const connected = new Set(user.accounts.map((a) => a.provider));
    const oidcEnabled = enabledOAuthProviders.includes(OIDC_PROVIDER_ID);

    return {
      accounts: [
        ...OAUTH_PROVIDERS.map((provider) => ({
          provider,
          connected: connected.has(provider),
          available: enabledOAuthProviders.includes(provider),
        })),
        ...(oidcEnabled
          ? [
              {
                provider: OIDC_PROVIDER_ID,
                connected: connected.has(OIDC_PROVIDER_ID),
                available: true,
                label: oidcProviderName,
              },
            ]
          : []),
      ],
      hasPasskey: user.authenticators.length > 0,
    };
  },
);
