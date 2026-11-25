"use client";

import { Suspense, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginWithEmail, loginWithMagicLink, resendConfirmation } from "@/app/actions/auth";
import type { FormErrors } from "@/types/auth";
import TurnstileWidget from "@/components/TurnstileWidget";
import type { TurnstileWidgetHandle } from "@/components/TurnstileWidget";
import PasswordInput from "@/components/PasswordInput";
import styles from "./login.module.css";

/** Tylko bezpieczne ścieżki względne — blokuje Open Redirect (np. //evil.com, /\evil.com, https://...). */
function getSafeRedirectPath(value: string | null, fallback = "/konto"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect");
  const redirectTo = getSafeRedirectPath(rawRedirect, "/konto");
  const registerHref =
    rawRedirect && redirectTo !== "/konto"
      ? `/register?redirect=${encodeURIComponent(redirectTo)}`
      : "/register";
  const callbackError = searchParams.get("error");

  const [tab, setTab] = useState<"password" | "magic">(
    callbackError === "magiclink_expired" ? "magic" : "password"
  );
  const [showResendView, setShowResendView] = useState(
    callbackError === "confirmation_expired"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>(() => {
    if (callbackError === "magiclink_expired") {
      return {
        general: "Ihr Magic Link ist abgelaufen oder wurde bereits verwendet. Bitte fordern Sie unten einen neuen an.",
      };
    }
    if (callbackError === "auth_callback_failed") {
      return { general: "Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut." };
    }
    return {};
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // W danym momencie zamontowana jest tylko jedna zakładka, więc jeden ref
  // obsługuje oba widgety.
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken(null);
  }, []);

  /**
   * Token Turnstile jest jednorazowy — po nieudanej próbie trzeba zamówić nowy,
   * inaczej kolejne wysłanie odpadnie na weryfikacji mimo poprawnych danych.
   */
  const resetTurnstile = useCallback(() => {
    setTurnstileToken(null);
    turnstileRef.current?.reset();
  }, []);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (!turnstileToken) {
      setErrors({ general: "Bitte bestätigen Sie, dass Sie kein Roboter sind" });
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData();
    formData.set("email", email);
    formData.set("password", password);
    formData.set("turnstileToken", turnstileToken);

    const result = await loginWithEmail(formData);
    setIsSubmitting(false);

    if (!result.success) {
      setErrors({ general: result.error });
      resetTurnstile();
      return;
    }

    // Pełne przeładowanie, nie router.push(). Logowanie odbywa się w server
    // action, więc klient przeglądarki nie wie o nowej sesji: AuthProvider
    // siedzi w głównym layoucie i przy miękkiej nawigacji nie montuje się
    // ponownie, a onAuthStateChange nie wypala dla logowania po stronie
    // serwera. Kontekst zostawałby z user: null i wszystkie ekrany oparte
    // na useAuth() byłyby puste aż do ręcznego odświeżenia.
    window.location.assign(redirectTo);
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (!turnstileToken) {
      setErrors({ general: "Bitte bestätigen Sie, dass Sie kein Roboter sind" });
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

    setMagicSent(true);
  }

  async function handleResendConfirmation(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (!turnstileToken) {
      setErrors({ general: "Bitte bestätigen Sie, dass Sie kein Roboter sind" });
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData();
    formData.set("email", email);
    formData.set("turnstileToken", turnstileToken);

    const result = await resendConfirmation(formData);
    setIsSubmitting(false);

    if (!result.success) {
      setErrors({ general: result.error });
      resetTurnstile();
      return;
    }

    setResendSent(true);
  }

  if (showResendView) {
    return (
      <div className={styles.card}>
        <h1 className={styles.title}>Anmelden</h1>

        {resendSent ? (
          <p className={styles.successMessage}>
            Wir haben Ihnen einen neuen Bestätigungslink an <strong>{email}</strong>{" "}
            gesendet.
            <br />
            <br /> Bitte prüfen Sie Ihr Postfach.
          </p>
        ) : (
          <form onSubmit={handleResendConfirmation} className={styles.form} noValidate>
            <p className={styles.magicDescription}>
              {callbackError === "confirmation_expired"
                ? "Ihr Bestätigungslink ist abgelaufen oder wurde bereits verwendet. Geben Sie Ihre E-Mail-Adresse ein, um einen neuen zu erhalten."
                : "Geben Sie Ihre E-Mail-Adresse ein, um einen neuen Bestätigungslink zu erhalten."}
            </p>
            {errors.general && (
              <p className={styles.errorMessage}>{errors.general}</p>
            )}
            <div className={styles.field}>
              <label htmlFor="email-resend" className={styles.label}>
                E-Mail
              </label>
              <input
                id="email-resend"
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
              {isSubmitting ? "Wird gesendet…" : "Neuen Bestätigungslink senden"}
            </button>
          </form>
        )}

        <p className={styles.registerLink}>
          <button
            type="button"
            onClick={() => {
              setShowResendView(false);
              setResendSent(false);
              setErrors({});
              resetTurnstile();
            }}
            className={styles.link}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            ← Zurück zum Login
          </button>
        </p>
      </div>
    );
  }

  const isUnconfirmedEmailError =
    errors.general?.includes("bestätigen Sie zuerst Ihre E-Mail-Adresse") ?? false;

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>Anmelden</h1>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "password" ? styles.tabActive : ""}`}
          onClick={() => {
            setTab("password");
            setErrors({});
          }}
          type="button"
        >
          Passwort
        </button>
        <button
          className={`${styles.tab} ${tab === "magic" ? styles.tabActive : ""}`}
          onClick={() => {
            setTab("magic");
            setErrors({});
          }}
          type="button"
        >
          Magic Link
        </button>
      </div>

      {errors.general && (
        <div className={styles.errorBox}>
          <span>{errors.general}</span>
          {isUnconfirmedEmailError && (
            <button
              type="button"
              className={styles.inlineActionBtn}
              onClick={() => {
                setErrors({});
                setResendSent(false);
                setShowResendView(true);
                resetTurnstile();
              }}
            >
              Bestätigungs-E-Mail erneut senden →
            </button>
          )}
        </div>
      )}

      {tab === "password" && (
        <form onSubmit={handlePasswordLogin} className={styles.form} noValidate>
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
          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>
              Passwort
            </label>
            <PasswordInput
              id="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <div className={styles.forgotRow}>
            <Link href="/passwort-vergessen" className={styles.link}>
              Passwort vergessen?
            </Link>
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
            {isSubmitting ? "Wird angemeldet…" : "Anmelden"}
          </button>
        </form>
      )}

      {tab === "magic" && (
        <>
          {magicSent ? (
            <p className={styles.successMessage}>
              Wir haben Ihnen einen Magic Link an <strong>{email}</strong>{" "}
              gesendet.
              <br />
              <br /> Bitte prüfen Sie Ihr Postfach.
            </p>
          ) : (
            <form onSubmit={handleMagicLink} className={styles.form} noValidate>
              <p className={styles.magicDescription}>
                Kein Passwort nötig. Geben Sie Ihre E-Mail-Adresse ein und wir
                senden Ihnen einen einmaligen Link — ein Klick darauf und Sie
                sind sofort eingeloggt.
              </p>
              <div className={styles.field}>
                <label htmlFor="email-magic" className={styles.label}>
                  E-Mail
                </label>
                <input
                  id="email-magic"
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
                {isSubmitting ? "Wird gesendet…" : "Magic Link senden"}
              </button>
            </form>
          )}
        </>
      )}

      <p className={styles.registerLink}>
        Noch kein Konto?{" "}
        <Link href={registerHref} className={styles.link}>
          Jetzt registrieren
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
