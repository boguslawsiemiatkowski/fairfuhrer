"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { updatePassword } from "@/app/actions/auth";
import { strongPasswordSchema, firstZodError } from "@/lib/validations/api";
import type { FormErrors } from "@/types/auth";
import PasswordInput from "@/components/PasswordInput";
import PasswordChecklist from "@/components/PasswordChecklist";
import styles from "./reset-password.module.css";

export default function ResetPasswordPage() {
  const [isReady, setIsReady] = useState(false);
  const [isInvalidLink, setIsInvalidLink] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsReady(true);
      } else {
        setIsInvalidLink(true);
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const pwParsed = strongPasswordSchema.safeParse(password);
    if (!pwParsed.success) {
      setErrors({ password: firstZodError(pwParsed.error) });
      return;
    }

    if (password !== confirmPassword) {
      setErrors({ confirmPassword: "Passwörter stimmen nicht überein." });
      return;
    }

    setIsSubmitting(true);
    const result = await updatePassword(password);
    setIsSubmitting(false);

    if (!result.success) {
      setErrors({ general: result.error });
      return;
    }

    setSuccess(true);
    setTimeout(() => window.location.assign(result.redirectTo ?? "/konto"), 2000);
  }

  if (isInvalidLink) {
    return (
      <div className={styles.card}>
        <p className={styles.errorMessage}>
          Dieser Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen{" "}
          <Link href="/passwort-vergessen" className={styles.link}>
            Passwort-Reset-Link
          </Link>{" "}
          an.
        </p>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className={styles.card}>
        <p className={styles.loading}>Wird geladen…</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className={styles.card}>
        <p className={styles.successMessage}>
          Passwort erfolgreich geändert. Sie werden zu Ihrem Konto weitergeleitet…
        </p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>Neues Passwort festlegen</h1>

      {errors.general && (
        <p className={styles.errorMessage}>{errors.general}</p>
      )}

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <div className={styles.field}>
          <label htmlFor="password" className={styles.label}>
            Neues Passwort *
          </label>
          <PasswordInput
            id="password"
            className={`${styles.input} ${errors.password ? styles.inputError : ""}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <PasswordChecklist password={password} />
          {errors.password && (
            <span className={styles.fieldError}>{errors.password}</span>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="confirmPassword" className={styles.label}>
            Passwort bestätigen *
          </label>
          <PasswordInput
            id="confirmPassword"
            className={`${styles.input} ${errors.confirmPassword ? styles.inputError : ""}`}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
          {errors.confirmPassword && (
            <span className={styles.fieldError}>{errors.confirmPassword}</span>
          )}
        </div>

        <button
          type="submit"
          className={styles.submitButton}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Wird gespeichert…" : "Passwort speichern"}
        </button>
      </form>
    </div>
  );
}
