"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/atoms/Input/Input";
import { AuthCard } from "@/features/auth/components/AuthCard/AuthCard";
import { completeOnboarding } from "@/features/onboarding/actions";
import { useRouter } from "@/i18n/navigation";
import styles from "./onboardingForm.module.scss";

interface OnboardingFormProps {
  initialHandle: string;
  initialFirstName: string;
  initialLastName: string;
}

/**
 * Letzter Schritt vor dem ersten Workspace: Benutzername (Pflicht, beim
 * Konto-Anlegen nur automatisch aus der E-Mail abgeleitet, siehe `auth.ts`)
 * und Vorname (Pflicht) eintragen, Nachname optional. Nach dem Absenden geht
 * es zurück zu „/“ — die dortige Weiterleitung entscheidet dann wie gewohnt
 * zwischen bestehendem Workspace und `/create-workspace`.
 */
export function OnboardingForm({
  initialHandle,
  initialFirstName,
  initialLastName,
}: OnboardingFormProps) {
  const t = useTranslations();
  const router = useRouter();
  const [handle, setHandle] = useState(initialHandle);
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setError("");
    startTransition(async () => {
      const result = await completeOnboarding({ handle, firstName, lastName });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push("/");
    });
  };

  return (
    <AuthCard
      title={t("onboarding.title")}
      subtitle={t("onboarding.subtitle")}
      error={error}
      submitLabel={t("onboarding.continue")}
      onSubmit={submit}
    >
      <Input
        id="onboarding-handle"
        label={t("account.handle")}
        hint={t("account.handleDesc")}
        prefix="@"
        value={handle}
        disabled={isPending}
        onChange={(e) => setHandle(e.target.value)}
      />
      <div className={styles.nameRow}>
        <Input
          id="onboarding-first-name"
          label={t("login.firstName")}
          placeholder={t("login.firstNamePlaceholder")}
          value={firstName}
          disabled={isPending}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <Input
          id="onboarding-last-name"
          label={t("login.lastName")}
          placeholder={t("login.lastNamePlaceholder")}
          value={lastName}
          disabled={isPending}
          onChange={(e) => setLastName(e.target.value)}
        />
      </div>
    </AuthCard>
  );
}
