"use client";

import { Suspense, useState, useCallback, useRef } from "react";
import { Mail } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { registerConsumer } from "@/app/actions/auth";
import type { FormErrors } from "@/types/auth";
import TurnstileWidget from "@/components/TurnstileWidget";
import type { TurnstileWidgetHandle } from "@/components/TurnstileWidget";
import PasswordInput from "@/components/PasswordInput";
import PasswordChecklist from "@/components/PasswordChecklist";
// Social loginy (Apple/Google) sind in 1.0.3 vorübergehend deaktiviert —
// Konsistenz mit Mobile (siehe project_social_loginy_zawieszone).
// import SocialLoginButtons from "@/components/SocialLoginButtons";
import styles from "./consumer.module.css";

function getSafeRedirectPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return null;
  }
  return value;
}

function validatePassword(password: string): string | null {
  if (password.length < 8)
    return "Das Passwort muss mindestens 8 Zeichen lang sein.";
  if (!/[A-Z]/.test(password))
    return "Das Passwort muss mindestens einen Großbuchstaben enthalten.";
  if (!/[a-z]/.test(password))
    return "Das Passwort muss mindestens einen Kleinbuchstaben enthalten.";
  if (!/[0-9]/.test(password))
    return "Das Passwort muss mindestens eine Ziffer enthalten.";
  if (!/[^A-Za-z0-9]/.test(password))
    return "Das Passwort muss mindestens ein Sonderzeichen enthalten.";
  return null;
}

function RegisterConsumerForm() {
  const searchParams = useSearchParams();
  const safeRedirect = getSafeRedirectPath(searchParams.get("redirect"));
  const redirectQuery = safeRedirect ? `?redirect=${encodeURIComponent(safeRedirect)}` : "";

  const [fields, setFields] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    username: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken(null);
  }, []);

  /**
   * Token Turnstile jest jednorazowy — po nieudanej probie trzeba zamowic nowy,
   * inaczej kolejne wyslanie odpadnie na weryfikacji mimo poprawnych danych.
   */
  const resetTurnstile = useCallback(() => {
    setTurnstileToken(null);
    turnstileRef.current?.reset();
  }, []);

  function set(key: keyof typeof fields) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setFields((prev) => ({ ...prev, [key]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const newErrors: FormErrors = {};
    if (!fields.username) newErrors.username = "Pflichtfeld";
    if (!fields.email) newErrors.email = "Pflichtfeld";
    if (!fields.password) {
      newErrors.password = "Pflichtfeld";
    } else {
      const pwError = validatePassword(fields.password);
      if (pwError) newErrors.password = pwError;
    }
    if (fields.password !== fields.confirmPassword)
      newErrors.confirmPassword = "Passwörter stimmen nicht überein.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (!turnstileToken) {
      setErrors({
        general: "Bitte bestätigen Sie, dass Sie kein Roboter sind",
      });
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    Object.entries(fields).forEach(([k, v]) => formData.set(k, v));
    formData.set("turnstileToken", turnstileToken);

    const result = await registerConsumer(formData);
    setIsSubmitting(false);

    if (!result.success) {
      setErrors({ general: result.error });
      resetTurnstile();
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <div className={styles.card}>
        <div className={styles.successBox}>
          <div className={styles.successIconWrap}>
            <Mail size={32} />
          </div>
          <h2 className={styles.successTitle}>Fast geschafft!</h2>
          <p className={styles.successText}>
            Wir haben eine Bestätigungs-E-Mail an{" "}
            <strong>{fields.email}</strong> gesendet.
          </p>
          <p className={styles.successText}>
            Bitte klicke auf den Link in der E-Mail, um dein Konto zu
            aktivieren. Danach kannst du dich anmelden.
          </p>
          <p className={styles.successHint}>
            Keine E-Mail erhalten? Bitte prüfe deinen Spam-Ordner.
          </p>
          <Link
            href={`/login${redirectQuery}`}
            className={styles.submitButton}
            style={{ textAlign: "center", textDecoration: "none", display: "block", boxSizing: "border-box" }}
          >
            Zur Anmeldung
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <Link href={`/register${redirectQuery}`} className={styles.back}>
        ← Zurück
      </Link>
      <h1 className={styles.title}>Werde Teil der Fairführer-Community</h1>

      {errors.general && (
        <p className={styles.errorMessage}>{errors.general}</p>
      )}

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <div className={styles.field}>
          <label htmlFor="username" className={styles.label}>
            Benutzername *
          </label>
          <input
            id="username"
            type="text"
            className={`${styles.input} ${errors.username ? styles.inputError : ""}`}
            value={fields.username}
            onChange={set("username")}
            autoComplete="username"
          />
          <span className={styles.hint}>
            Ihr öffentlich sichtbarer Name in der Community.
          </span>
          {errors.username && (
            <span className={styles.fieldError}>{errors.username}</span>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="email" className={styles.label}>
            E-Mail *
          </label>
          <input
            id="email"
            type="email"
            className={`${styles.input} ${errors.email ? styles.inputError : ""}`}
            value={fields.email}
            onChange={set("email")}
            autoComplete="email"
          />
          {errors.email && (
            <span className={styles.fieldError}>{errors.email}</span>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="password" className={styles.label}>
            Passwort *
          </label>
          <PasswordInput
            id="password"
            className={`${styles.input} ${errors.password ? styles.inputError : ""}`}
            value={fields.password}
            onChange={set("password")}
            autoComplete="new-password"
          />
          <PasswordChecklist password={fields.password} />
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
            value={fields.confirmPassword}
            onChange={set("confirmPassword")}
            autoComplete="new-password"
          />
          {errors.confirmPassword && (
            <span className={styles.fieldError}>{errors.confirmPassword}</span>
          )}
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
          {isSubmitting ? "Wird registriert…" : "Konto erstellen"}
        </button>
      </form>

      <p className={styles.loginLink}>
        Bereits registriert?{" "}
        <Link href={`/login${redirectQuery}`} className={styles.link}>
          Anmelden
        </Link>
      </p>
    </div>
  );
}

export default function RegisterConsumerPage() {
  return (
    <Suspense>
      <RegisterConsumerForm />
    </Suspense>
  );
}
