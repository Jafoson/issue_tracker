"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { sendMagicLink } from "@/features/auth/actions";
import { AuthCard } from "@/features/auth/components/AuthCard/AuthCard";
import { Link } from "@/i18n/navigation";
import styles from "./verifyCodeForm.module.scss";

const CODE_LENGTH = 8;

interface VerifyCodeFormProps {
  email: string;
  callbackUrl?: string;
}

/**
 * Eigene Seite statt Inline-Feld unter dem "Magic Link senden"-Button: acht
 * einzelne Kästchen für den Code aus der Mail (`auth.ts`s
 * `generateMagicCode()` — selbes Alphabet, selbe Länge). Verifiziert wird per
 * `fetch` gegen dieselbe next-auth-Route, die auch der Link ansteuert
 * (`/api/auth/callback/nodemailer`) — bei Erfolg setzt schon die Antwort das
 * Session-Cookie, ein voller Redirect reicht danach zum Einloggen. Ein
 * Fehlschlag bleibt bewusst auf dieser Seite statt auf next-auths
 * `pages.error`-Ziel zu landen: die eingegebene E-Mail bleibt so erhalten,
 * ein erneuter Versuch braucht kein erneutes Eintippen.
 */
export function VerifyCodeForm({ email, callbackUrl }: VerifyCodeFormProps) {
  const t = useTranslations();
  const [digits, setDigits] = useState<string[]>(() =>
    Array(CODE_LENGTH).fill(""),
  );
  const [error, setError] = useState("");
  const [resent, setResent] = useState(false);
  const [isVerifying, startVerifying] = useTransition();
  const [isResending, startResending] = useTransition();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const verify = (fullCode: string) => {
    setError("");
    startVerifying(async () => {
      const params = new URLSearchParams({
        token: fullCode,
        email,
        callbackUrl: callbackUrl || "/",
      });
      const res = await fetch(`/api/auth/callback/nodemailer?${params}`, {
        redirect: "follow",
      });
      if (new URL(res.url).searchParams.has("error")) {
        setError(t("login.codeInvalid"));
        setDigits(Array(CODE_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
        return;
      }
      window.location.href = callbackUrl || "/";
    });
  };

  const fillFrom = (index: number, chars: string) => {
    const next = [...digits];
    let i = index;
    for (const ch of chars) {
      if (i >= CODE_LENGTH) break;
      next[i] = ch;
      i++;
    }
    setDigits(next);
    const focusIndex = Math.min(i, CODE_LENGTH - 1);
    requestAnimationFrame(() => inputRefs.current[focusIndex]?.focus());
    if (next.every(Boolean)) verify(next.join(""));
  };

  const onChange = (index: number, raw: string) => {
    const clean = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (clean) {
      fillFrom(index, clean.slice(-1));
      return;
    }
    const next = [...digits];
    next[index] = "";
    setDigits(next);
  };

  const onPaste = (
    index: number,
    e: React.ClipboardEvent<HTMLInputElement>,
  ) => {
    e.preventDefault();
    const clean = e.clipboardData
      .getData("text")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();
    if (clean) fillFrom(index, clean);
  };

  const onKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      e.preventDefault();
      const next = [...digits];
      next[index - 1] = "";
      setDigits(next);
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const resend = () => {
    startResending(async () => {
      setResent(false);
      const result = await sendMagicLink(email, callbackUrl);
      if (!("error" in result)) setResent(true);
    });
  };

  const isComplete = digits.every(Boolean);

  return (
    <AuthCard
      title={t("login.verifyTitle")}
      subtitle={t("login.verifySubtitle", { email })}
      error={error}
      extra={
        <div className={styles.links}>
          <button
            type="button"
            className={styles.link}
            disabled={isResending}
            onClick={resend}
          >
            {resent ? t("login.resendSent") : t("login.resendCode")}
          </button>
          <Link href="/login" className={styles.link}>
            {t("login.backToLogin")}
          </Link>
        </div>
      }
    >
      <div className={styles.boxes}>
        {digits.map((digit, i) => (
          <input
            key={`code-box-${
              // biome-ignore lint/suspicious/noArrayIndexKey: feste, nie umsortierte Länge (CODE_LENGTH)
              i
            }`}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            className={styles.box}
            value={digit}
            inputMode="text"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={1}
            disabled={isVerifying}
            aria-label={`${t("login.codeLabel")} ${i + 1}/${CODE_LENGTH}`}
            onChange={(e) => onChange(i, e.target.value)}
            onPaste={(e) => onPaste(i, e)}
            onKeyDown={(e) => onKeyDown(i, e)}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="primary"
        size="lg"
        full
        disabled={!isComplete || isVerifying}
        onClick={() => verify(digits.join(""))}
      >
        {t("login.verifyCode")}
      </Button>
    </AuthCard>
  );
}
