"use client";

import { Icon } from "@iconify/react";
import { signIn } from "next-auth/webauthn";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { OptionButton } from "@/components/ui/atoms/OptionButton/OptionButton";

interface Props {
  callbackUrl?: string;
  onError: (message: string) => void;
}

/**
 * Login per Passkey — ohne E-Mail-Feld. Ohne `email`-Parameter fällt
 * next-auths `getUserInfo` auf `undefined` zurück, was auf „authenticate"
 * ohne vorgegebenen Nutzer entscheidet: der Browser zeigt alle für diese
 * Seite hinterlegten Passkeys selbst an (discoverable credentials) — dieselbe
 * „nutzerlos"-Ceremony wie 1Password, GitHub & Co.
 *
 * Die Ceremony (Browser-Prompt, Prüfung) übernimmt `next-auth/webauthn`s
 * `signIn` vollständig — sie holt die Optionen vom Server, ruft
 * `@simplewebauthn/browser` auf und postet die Antwort zurück.
 *
 * Bricht die Person den Browser-Prompt ab (kein Passkey ausgewählt, Timeout),
 * wirft `startAuthentication` vor jedem Server-Kontakt — das fängt nur dieser
 * try/catch ab, `next-auth/webauthn` selbst tut es nicht.
 */
export function PasskeyLoginButton({ callbackUrl, onError }: Props) {
  const t = useTranslations();
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    onError("");
    startTransition(async () => {
      try {
        await signIn("webauthn", { redirectTo: callbackUrl || "/" });
      } catch {
        onError(t("login.passkeyFailed"));
      }
    });
  };

  return (
    <OptionButton
      variant="primary"
      disabled={isPending}
      icon={<Icon icon="lucide:fingerprint" width={18} />}
      title={t("login.withPasskey")}
      onClick={submit}
    />
  );
}
