"use client";

import { Suspense, useState, useCallback, useRef } from "react";
import { Mail } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { registerPartner } from "@/app/actions/auth";
import type { FormErrors } from "@/types/auth";
import TurnstileWidget from "@/components/TurnstileWidget";
import type { TurnstileWidgetHandle } from "@/components/TurnstileWidget";
import PasswordInput from "@/components/PasswordInput";
import PasswordChecklist from "@/components/PasswordChecklist";
import styles from "./partner.module.css";
import { COUNTRIES, getCountry } from "@/lib/countries";

function getSafeRedirectPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return null;
  }
  return value;
}

function validatePassword(password: string): string | null {
  if (password.length < 8) return "Das Passwort muss mindestens 8 Zeichen lang sein.";
  if (!/[A-Z]/.test(password)) return "Das Passwort muss mindestens einen Großbuchstaben enthalten.";
  if (!/[a-z]/.test(password)) return "Das Passwort muss mindestens einen Kleinbuchstaben enthalten.";
  if (!/[0-9]/.test(password)) return "Das Passwort muss mindestens eine Ziffer enthalten.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Das Passwort muss mindestens ein Sonderzeichen enthalten.";
  return null;
}

function RegisterPartnerForm() {
  const searchParams = useSearchParams();
  const safeRedirect = getSafeRedirectPath(searchParams.get("redirect"));
  const redirectQuery = safeRedirect ? `?redirect=${encodeURIComponent(safeRedirect)}` : "";

  const [fields, setFields] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    companyName: "",
    street: "",
    city: "",
    postalCode: "",
    country: "DE",
    contactEmail: "",
    phone: "",
    businessEmail: "",
    taxIdValue: "",
    websiteUrl: "",
  });
  const [noEuVat, setNoEuVat] = useState(false);
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
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFields((prev) => ({ ...prev, [key]: e.target.value }));
  }

  function handleCountryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setFields((prev) => ({ ...prev, country: e.target.value, taxIdValue: "" }));
    setNoEuVat(false);
    setErrors((prev) => ({ ...prev, taxIdValue: undefined }));
  }

  const selectedCountry = getCountry(fields.country);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const newErrors: FormErrors = {};

    if (!fields.companyName) newErrors.companyName = "Pflichtfeld";
    if (!fields.street) newErrors.street = "Pflichtfeld";
    if (!fields.postalCode) newErrors.postalCode = "Pflichtfeld";
    if (!fields.city) newErrors.city = "Pflichtfeld";

    // Steuer-ID Validierung: Pflicht für DE, optional für alle anderen wenn kein Checkbox
    if (selectedCountry?.taxGroup === "DE" && !fields.taxIdValue) {
      newErrors.taxIdValue = "Pflichtfeld";
    } else if (
      selectedCountry?.taxGroup === "EU" &&
      !noEuVat &&
      !fields.taxIdValue
    ) {
      newErrors.taxIdValue = "Bitte geben Sie Ihre EU-USt-IdNr. ein oder aktivieren Sie die Checkbox unten.";
    }

    if (!fields.firstName) newErrors.firstName = "Pflichtfeld";
    if (!fields.lastName) newErrors.lastName = "Pflichtfeld";
    if (!fields.contactEmail) newErrors.contactEmail = "Pflichtfeld";

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
      setErrors({ general: "Bitte bestätigen Sie, dass Sie kein Roboter sind." });
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    Object.entries(fields).forEach(([k, v]) => formData.set(k, v));
    formData.set("businessEmail", fields.contactEmail);
    formData.set("noEuVat", noEuVat ? "true" : "false");
    formData.set("turnstileToken", turnstileToken);

    const result = await registerPartner(formData);
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
            Bitte klicken Sie auf den Link in der E-Mail, um Ihr Partnerkonto zu
            aktivieren. Danach können Sie sich anmelden.
          </p>
          <p className={styles.successHint}>
            Keine E-Mail erhalten? Bitte prüfen Sie Ihren Spam-Ordner.
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
      <h1 className={styles.title}>Als Partner*in registrieren</h1>

      {errors.general && (
        <p className={styles.errorMessage}>{errors.general}</p>
      )}

      <form onSubmit={handleSubmit} className={styles.form} noValidate>

        {/* ── 1. Unternehmensdaten ── */}
        <h2 className={styles.sectionTitle}>1. Unternehmensdaten</h2>

        <div className={styles.field}>
          <label htmlFor="companyName" className={styles.label}>Unternehmensname *</label>
          <input id="companyName" type="text"
            className={`${styles.input} ${errors.companyName ? styles.inputError : ""}`}
            value={fields.companyName} onChange={set("companyName")} autoComplete="organization" />
          {errors.companyName && <span className={styles.fieldError}>{errors.companyName}</span>}
        </div>

        <div className={styles.field}>
          <label htmlFor="street" className={styles.label}>Straße und Hausnummer *</label>
          <input id="street" type="text"
            className={`${styles.input} ${errors.street ? styles.inputError : ""}`}
            value={fields.street} onChange={set("street")} autoComplete="street-address" />
          {errors.street && <span className={styles.fieldError}>{errors.street}</span>}
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="postalCode" className={styles.label}>PLZ *</label>
            <input id="postalCode" type="text"
              className={`${styles.input} ${errors.postalCode ? styles.inputError : ""}`}
              value={fields.postalCode} onChange={set("postalCode")} autoComplete="postal-code" />
            {errors.postalCode && <span className={styles.fieldError}>{errors.postalCode}</span>}
          </div>
          <div className={styles.field}>
            <label htmlFor="city" className={styles.label}>Stadt *</label>
            <input id="city" type="text"
              className={`${styles.input} ${errors.city ? styles.inputError : ""}`}
              value={fields.city} onChange={set("city")} autoComplete="address-level2" />
            {errors.city && <span className={styles.fieldError}>{errors.city}</span>}
          </div>
        </div>

        {/* Land — zmiana kraju resetuje pole podatkowe */}
        <div className={styles.field}>
          <label htmlFor="country" className={styles.label}>Land *</label>
          <select id="country" className={styles.select} value={fields.country} onChange={handleCountryChange}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Dynamiczne pole podatkowe — zależy od wybranego kraju */}
        {selectedCountry && (
          <div className={styles.field}>
            <label htmlFor="taxIdValue" className={styles.label}>
              {selectedCountry.taxIdLabel}
              {selectedCountry.taxIdRequired || (selectedCountry.taxGroup === "EU" && !noEuVat) ? " *" : ""}
              {selectedCountry.taxGroup === "THIRD" || selectedCountry.taxGroup === "EEA_NON_EU" || selectedCountry.taxGroup === "SPECIAL"
                ? <span className={styles.optional}> (optional)</span>
                : null}
            </label>
            <input
              id="taxIdValue"
              type="text"
              className={`${styles.input} ${errors.taxIdValue ? styles.inputError : ""}`}
              value={fields.taxIdValue}
              onChange={set("taxIdValue")}
              placeholder={selectedCountry.taxIdPlaceholder}
              autoComplete="off"
              disabled={selectedCountry.taxGroup === "EU" && noEuVat}
            />
            {selectedCountry.taxGroup === "DE" && (
              <span className={styles.hint}>
                Ihre Steuernummer vom Finanzamt. Wird für die Rechnungsstellung benötigt.
              </span>
            )}
            {selectedCountry.taxGroup === "EU" && !noEuVat && (
              <span className={styles.hint}>
                Mit gültiger EU-USt-IdNr. gilt das Reverse-Charge-Verfahren — keine deutsche MwSt.
              </span>
            )}
            {selectedCountry.taxGroup === "EU" && noEuVat && (
              <span className={styles.hint}>
                Ohne EU-USt-IdNr. wird deutsche MwSt. 19% berechnet (Kleinunternehmer o.ä.).
              </span>
            )}
            {(selectedCountry.taxGroup === "SPECIAL" || selectedCountry.taxGroup === "EEA_NON_EU") && (
              <span className={styles.hint}>
                Keine deutsche Umsatzsteuer — Leistungsort im Empfängerland.
              </span>
            )}
            {selectedCountry.taxGroup === "THIRD" && (
              <span className={styles.hint}>
                Keine deutsche Umsatzsteuer. Steuerliche Behandlung nach dem Recht des Empfängerlandes.
              </span>
            )}
            {errors.taxIdValue && <span className={styles.fieldError}>{errors.taxIdValue}</span>}
          </div>
        )}

        {/* Checkbox "kein EU-VAT" — nur für EU-Länder außer DE */}
        {selectedCountry?.hasEuVatOption && (
          <div className={styles.checkboxField}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={noEuVat}
                onChange={(e) => {
                  setNoEuVat(e.target.checked);
                  if (e.target.checked) {
                    setFields((prev) => ({ ...prev, taxIdValue: "" }));
                    setErrors((prev) => ({ ...prev, taxIdValue: undefined }));
                  }
                }}
              />
              <span>
                Ich habe keine EU-USt-IdNr.{" "}
                <span className={styles.checkboxHint}>(z.B. Kleinunternehmer, steuerbefreite Organisation)</span>
              </span>
            </label>
          </div>
        )}

        {/* ── 2. Kontaktdaten ── */}
        <h2 className={styles.sectionTitle}>2. Kontaktdaten</h2>

        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="firstName" className={styles.label}>Vorname *</label>
            <input id="firstName" type="text"
              className={`${styles.input} ${errors.firstName ? styles.inputError : ""}`}
              value={fields.firstName} onChange={set("firstName")} autoComplete="given-name" />
            {errors.firstName && <span className={styles.fieldError}>{errors.firstName}</span>}
          </div>

          <div className={styles.field}>
            <label htmlFor="lastName" className={styles.label}>Nachname *</label>
            <input id="lastName" type="text"
              className={`${styles.input} ${errors.lastName ? styles.inputError : ""}`}
              value={fields.lastName} onChange={set("lastName")} autoComplete="family-name" />
            {errors.lastName && <span className={styles.fieldError}>{errors.lastName}</span>}
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="contactEmail" className={styles.label}>E-Mail-Adresse *</label>
          <input id="contactEmail" type="email"
            className={`${styles.input} ${errors.contactEmail ? styles.inputError : ""}`}
            value={fields.contactEmail} onChange={set("contactEmail")} autoComplete="email" />
          <span className={styles.hint}>
            Ihre persönliche Kontakt-E-Mail — nur wir nehmen darüber Kontakt mit Ihnen auf, sie ist nicht öffentlich sichtbar.
          </span>
          {errors.contactEmail && <span className={styles.fieldError}>{errors.contactEmail}</span>}
        </div>

        {/* ── 3. Zugangsdaten ── */}
        <h2 className={styles.sectionTitle}>3. Zugangsdaten</h2>

        <div className={styles.field}>
          <label htmlFor="email" className={styles.label}>Anmelde-E-Mail *</label>
          <input id="email" type="email"
            className={`${styles.input} ${errors.email ? styles.inputError : ""}`}
            value={fields.email} onChange={set("email")} autoComplete="email" />
          <span className={styles.hint}>
            Diese Adresse dient ausschließlich zum Einloggen und ist nicht öffentlich sichtbar.
          </span>
          {errors.email && <span className={styles.fieldError}>{errors.email}</span>}
        </div>

        <div className={styles.field}>
          <label htmlFor="password" className={styles.label}>Passwort *</label>
          <PasswordInput id="password"
            className={`${styles.input} ${errors.password ? styles.inputError : ""}`}
            value={fields.password} onChange={set("password")} autoComplete="new-password" />
          <PasswordChecklist password={fields.password} />
          {errors.password && <span className={styles.fieldError}>{errors.password}</span>}
        </div>

        <div className={styles.field}>
          <label htmlFor="confirmPassword" className={styles.label}>Passwort bestätigen *</label>
          <PasswordInput id="confirmPassword"
            className={`${styles.input} ${errors.confirmPassword ? styles.inputError : ""}`}
            value={fields.confirmPassword} onChange={set("confirmPassword")} autoComplete="new-password" />
          {errors.confirmPassword && <span className={styles.fieldError}>{errors.confirmPassword}</span>}
        </div>

        <TurnstileWidget
          ref={turnstileRef}
          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
          onVerify={handleTurnstileVerify}
          onExpire={handleTurnstileExpire}
        />

        <button type="submit" className={styles.submitButton} disabled={isSubmitting || !turnstileToken}>
          {isSubmitting ? "Wird registriert…" : "Partnerkonto erstellen"}
        </button>
      </form>

      <p className={styles.loginLink}>
        Bereits registriert?{" "}
        <Link href={`/login${redirectQuery}`} className={styles.link}>Anmelden</Link>
      </p>
    </div>
  );
}

export default function RegisterPartnerPage() {
  return (
    <Suspense>
      <RegisterPartnerForm />
    </Suspense>
  );
}
