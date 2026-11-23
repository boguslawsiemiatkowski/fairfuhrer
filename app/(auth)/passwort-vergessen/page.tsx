"use client";

import { Suspense, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginWithMagicLink, resetPassword } from "@/app/actions/auth";
import type { FormErrors } from "@/types/auth";
import TurnstileWidget, { type TurnstileWidgetHandle } from "@/components/TurnstileWidget";
import styles from "./forgot-password.module.css";

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const callbackError = searchParams.get("error");

  const [tab, setTab] = useState<"reset" | "magic">("reset");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FormErrors>(() => {
    if (callbackError === "recovery_expired") {
      return {
        general:
          "Ihr Link zum Zurücksetzen des Passworts ist abgelaufen oder wurde bereits verwendet. Bitte fordern Sie unten einen neuen an.",
      };
    }
    return {};
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken(null);
  }, []);

  const resetTurnstile = useCallback(() => {
    setTurnstileToken(null);
    turnstileRef.current?.reset();
  }, []);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (!turnstileToken) {
      setErrors({ general: "Bitte bestätigen Sie, dass Sie kein Roboter sind." });
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.set("email", email);
    formData.set("turnstileToken", turnstileToken);

    const result = await resetPassword(formData);
    setIsSubmitting(false);

    if (!result.success) {
      setErrors({ general: result.error });
      resetTurnstile();
      return;
    }

    setSent(true);
  }

  async function handleMagic(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (!turnstileToken) {
      setErrors({ general: "Bitte bestätigen Sie, dass Sie kein Roboter sind." });
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData();
    formData.set("email", email);
    formData.set("turnstileToken", turnstileToken);
    const result = await loginWithMagicLink(formData);
    setIsSubmitting(false);

    if (!result.success) {
      setErrors({ general: result.error });
      resetTurnstile();
      return;
    }

    setSent(true);
  }

  return (
    <div className={styles.card}>
      <Link href="/login" className={styles.back}>
        ← Zurück zur Anmeldung
      </Link>
      <h1 className={styles.title}>Passwort & Zugang</h1>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "reset" ? styles.tabActive : ""}`}
          onClick={() => {
            setTab("reset");
            setSent(false);
            setErrors({});
          }}
          type="button"
        >
          Passwort zurücksetzen
        </button>
        <button
          className={`${styles.tab} ${tab === "magic" ? styles.tabActive : ""}`}
          onClick={() => {
            setTab("magic");
            setSent(false);
            setErrors({});
          }}
          type="button"
        >
          Magic Link
        </button>
      </div>

      {errors.general && (
        <p className={styles.errorMessage}>{errors.general}</p>
      )}

      {sent ? (
        <p className={styles.successMessage}>
          {tab === "reset"
            ? "Wir haben Ihnen einen Link zum Zurücksetzen des Passworts gesendet. Bitte prüfen Sie Ihr Postfach."
            : "Wir haben Ihnen einen Magic Link gesendet. Bitte prüfen Sie Ihr Postfach."}
        </p>
      ) : (
        <form
          onSubmit={tab === "reset" ? handleReset : handleMagic}
          className={styles.form}
          noValidate
        >
          <p className={styles.description}>
            {tab === "reset"
              ? "Geben Sie Ihre E-Mail-Adresse ein. Sie erhalten einen Link zum Zurücksetzen Ihres Passworts."
              : "Geben Sie Ihre E-Mail-Adresse ein. Sie erhalten einen Magic Link, mit dem Sie sich ohne Passwort anmelden können."}
          </p>
          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>
              E-Mail
            </label>
            <input
              id="email"
              type="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <TurnstileWidget
            ref={turnstileRef}
            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
            onVerify={handleTurnstileVerify}
            onExpire={handleTurnstileExpire}
          />
          <button
            type="submit"
            className={styles.submitButton}
            disabled={isSubmitting || !turnstileToken}
          >
            {isSubmitting
              ? "Wird gesendet…"
              : tab === "reset"
                ? "Link senden"
                : "Magic Link senden"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
