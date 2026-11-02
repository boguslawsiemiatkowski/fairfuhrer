"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  updateEmail,
  updatePassword,
  updateConsumerProfile,
  updatePartnerProfile,
  deleteAccount,
} from "@/app/actions/auth";
import type { FormErrors } from "@/types/auth";
import { COUNTRIES } from "@/lib/countries";
import PasswordInput from "@/components/PasswordInput";
import styles from "@/app/(protected)/konto/einstellungen/einstellungen.module.css";

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

export default function PartnerEinstellungenPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const profile = user?.profile;
  const partner = user?.partnerProfile;

  // --- Anmelde-E-Mail ---
  const [newLoginEmail, setNewLoginEmail] = useState("");
  const [loginEmailError, setLoginEmailError] = useState<string | undefined>();
  const [loginEmailSuccess, setLoginEmailSuccess] = useState(false);
  const [isLoginEmailSubmitting, setIsLoginEmailSubmitting] = useState(false);

  // --- Passwort ---
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwErrors, setPwErrors] = useState<FormErrors>({});
  const [pwSuccess, setPwSuccess] = useState(false);
  const [isPwSubmitting, setIsPwSubmitting] = useState(false);

  // --- Kontaktdaten ---
  const [firstName, setFirstName] = useState(profile?.first_name ?? "");
  const [lastName, setLastName] = useState(profile?.last_name ?? "");
  const [contactEmail, setContactEmail] = useState(partner?.business_email ?? "");
  const [phoneNumber, setPhoneNumber] = useState(partner?.phone_number ?? "");
  const [contactErrors, setContactErrors] = useState<FormErrors>({});
  const [contactSuccess, setContactSuccess] = useState(false);
  const [isContactSubmitting, setIsContactSubmitting] = useState(false);

  // --- Unternehmensdaten ---
  const [companyName, setCompanyName] = useState(partner?.company_name ?? "");
  const [street, setStreet] = useState(partner?.street ?? "");
  const [postalCode, setPostalCode] = useState(partner?.postal_code ?? "");
  const [city, setCity] = useState(partner?.city ?? "");
  const [country, setCountry] = useState(partner?.country ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(partner?.website_url ?? "");
  const [phoneNumber2, setPhoneNumber2] = useState(partner?.phone_number_2 ?? "");
  const [taxId, setTaxId] = useState(partner?.tax_id ?? "");
  const [vatEu, setVatEu] = useState(partner?.vat_eu ?? "");
  const [companyErrors, setCompanyErrors] = useState<FormErrors>({});
  const [companySuccess, setCompanySuccess] = useState(false);
  const [isCompanySubmitting, setIsCompanySubmitting] = useState(false);

  // --- Social Media ---
  const [instagramUrl, setInstagramUrl] = useState(partner?.instagram_url ?? "");
  const [facebookUrl, setFacebookUrl] = useState(partner?.facebook_url ?? "");
  const [tiktokUrl, setTiktokUrl] = useState(partner?.tiktok_url ?? "");
  const [youtubeUrl, setYoutubeUrl] = useState(partner?.youtube_url ?? "");
  const [socialErrors, setSocialErrors] = useState<FormErrors>({});
  const [socialSuccess, setSocialSuccess] = useState(false);
  const [isSocialSubmitting, setIsSocialSubmitting] = useState(false);

  // --- Konto löschen ---
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();

  async function handleLoginEmailChange(e: React.FormEvent) {
    e.preventDefault();
    setLoginEmailError(undefined);
    setLoginEmailSuccess(false);
    if (!newLoginEmail.trim()) {
      setLoginEmailError("Bitte geben Sie eine neue E-Mail-Adresse ein.");
      return;
    }
    setIsLoginEmailSubmitting(true);
    const result = await updateEmail(newLoginEmail.trim());
    setIsLoginEmailSubmitting(false);
    if (!result.success) {
      setLoginEmailError(result.error);
      return;
    }
    setLoginEmailSuccess(true);
    setNewLoginEmail("");
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwErrors({});
    setPwSuccess(false);
    const pwError = validatePassword(password);
    if (pwError) {
      setPwErrors({ password: pwError });
      return;
    }
    if (password !== confirmPassword) {
      setPwErrors({ confirmPassword: "Passwörter stimmen nicht überein." });
      return;
    }
    setIsPwSubmitting(true);
    const result = await updatePassword(password);
    setIsPwSubmitting(false);
    if (!result.success) {
      setPwErrors({ general: result.error });
      return;
    }
    setPwSuccess(true);
    setPassword("");
    setConfirmPassword("");
  }

  async function handleContactUpdate(e: React.FormEvent) {
    e.preventDefault();
    setContactErrors({});
    setContactSuccess(false);
    setIsContactSubmitting(true);
    const [profileResult, partnerResult] = await Promise.all([
      updateConsumerProfile({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
      }),
      updatePartnerProfile({
        business_email: contactEmail.trim() || null,
        phone_number: phoneNumber.trim() || null,
      }),
    ]);
    setIsContactSubmitting(false);
    if (!profileResult.success || !partnerResult.success) {
      setContactErrors({ general: profileResult.error ?? partnerResult.error });
      return;
    }
    await refreshUser();
    setContactSuccess(true);
  }

  async function handleCompanyUpdate(e: React.FormEvent) {
    e.preventDefault();
    setCompanyErrors({});
    setCompanySuccess(false);
    setIsCompanySubmitting(true);
    const result = await updatePartnerProfile({
      company_name: companyName.trim() || null,
      street: street.trim() || null,
      postal_code: postalCode.trim() || null,
      city: city.trim() || null,
      country: country.trim() || null,
      website_url: websiteUrl.trim() || null,
      phone_number_2: phoneNumber2.trim() || null,
      tax_id: taxId.trim() || null,
      vat_eu: vatEu.trim() || null,
    });
    setIsCompanySubmitting(false);
    if (!result.success) {
      setCompanyErrors({ general: result.error });
      return;
    }
    await refreshUser();
    setCompanySuccess(true);
  }

  async function handleSocialUpdate(e: React.FormEvent) {
    e.preventDefault();
    setSocialErrors({});
    setSocialSuccess(false);
    setIsSocialSubmitting(true);
    const result = await updatePartnerProfile({
      instagram_url: instagramUrl.trim() || null,
      facebook_url: facebookUrl.trim() || null,
      tiktok_url: tiktokUrl.trim() || null,
      youtube_url: youtubeUrl.trim() || null,
    });
    setIsSocialSubmitting(false);
    if (!result.success) {
      setSocialErrors({ general: result.error });
      return;
    }
    await refreshUser();
    setSocialSuccess(true);
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== "LÖSCHEN") {
      setDeleteError('Bitte geben Sie "LÖSCHEN" zur Bestätigung ein.');
      return;
    }
    setIsDeleting(true);
    const result = await deleteAccount();
    if (!result.success) {
      setIsDeleting(false);
      setDeleteError(result.error ?? "Konto konnte nicht gelöscht werden.");
      return;
    }
    // Nawigacja przez router Next.js zamiast window.location.href (zgodnie z regułą @next/next/no-location-assign-relative-destination)
    await refreshUser();
    router.push("/");
    router.refresh();
  }

  return (
    <div className={styles.wrapper}>

      {/* Anmelde-E-Mail */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Anmelde-E-Mail ändern</h2>
        <p className={styles.currentValue}>
          Aktuelle Adresse: <strong>{user?.email}</strong>
        </p>
        {loginEmailError && <p className={styles.errorMessage}>{loginEmailError}</p>}
        {loginEmailSuccess && (
          <p className={styles.successMessage}>
            Bestätigungslink wurde an Ihre neue Adresse gesendet.
          </p>
        )}
        <form onSubmit={handleLoginEmailChange} className={styles.form} noValidate>
          <div className={styles.field}>
            <label htmlFor="new-login-email" className={styles.label}>
              Neue Anmelde-E-Mail
            </label>
            <input
              id="new-login-email"
              type="email"
              className={styles.input}
              value={newLoginEmail}
              onChange={(e) => setNewLoginEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <button type="submit" className={styles.button} disabled={isLoginEmailSubmitting}>
            {isLoginEmailSubmitting ? "Wird gesendet…" : "Ändern"}
          </button>
        </form>
      </section>

      {/* Passwort */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Passwort ändern</h2>
        {pwErrors.general && <p className={styles.errorMessage}>{pwErrors.general}</p>}
        {pwSuccess && <p className={styles.successMessage}>Passwort erfolgreich geändert.</p>}
        <form onSubmit={handlePasswordChange} className={styles.form} noValidate>
          <div className={styles.field}>
            <label htmlFor="pw-new" className={styles.label}>Neues Passwort *</label>
            <PasswordInput
              id="pw-new"
              className={`${styles.input} ${pwErrors.password ? styles.inputError : ""}`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <span className={styles.fieldHint}>
              Mind. 8 Zeichen, ein Großbuchstabe, ein Kleinbuchstabe, eine Ziffer und ein Sonderzeichen.
            </span>
            {pwErrors.password && <span className={styles.fieldError}>{pwErrors.password}</span>}
          </div>
          <div className={styles.field}>
            <label htmlFor="pw-confirm" className={styles.label}>Passwort bestätigen *</label>
            <PasswordInput
              id="pw-confirm"
              className={`${styles.input} ${pwErrors.confirmPassword ? styles.inputError : ""}`}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
            {pwErrors.confirmPassword && (
              <span className={styles.fieldError}>{pwErrors.confirmPassword}</span>
            )}
          </div>
          <button type="submit" className={styles.button} disabled={isPwSubmitting}>
            {isPwSubmitting ? "Wird gespeichert…" : "Passwort aktualisieren"}
          </button>
        </form>
      </section>

      {/* Kontaktdaten */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Kontaktdaten</h2>
        {contactErrors.general && <p className={styles.errorMessage}>{contactErrors.general}</p>}
        {contactSuccess && <p className={styles.successMessage}>Kontaktdaten erfolgreich aktualisiert.</p>}
        <form onSubmit={handleContactUpdate} className={styles.form} noValidate>
          <div className={styles.field}>
            <label htmlFor="firstName" className={styles.label}>Vorname</label>
            <input
              id="firstName"
              type="text"
              className={styles.input}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="lastName" className={styles.label}>Nachname</label>
            <input
              id="lastName"
              type="text"
              className={styles.input}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="contact-email" className={styles.label}>Kontakt-E-Mail</label>
            <input
              id="contact-email"
              type="email"
              className={styles.input}
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="phone-number" className={styles.label}>Telefon</label>
            <input
              id="phone-number"
              type="tel"
              className={styles.input}
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              autoComplete="tel"
            />
          </div>
          <button type="submit" className={styles.button} disabled={isContactSubmitting}>
            {isContactSubmitting ? "Wird gespeichert…" : "Aktualisieren"}
          </button>
        </form>
      </section>

      {/* Unternehmensdaten */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Unternehmensdaten</h2>
        {companyErrors.general && <p className={styles.errorMessage}>{companyErrors.general}</p>}
        {companySuccess && <p className={styles.successMessage}>Unternehmensdaten erfolgreich aktualisiert.</p>}
        <form onSubmit={handleCompanyUpdate} className={styles.form} noValidate>
          <div className={styles.field}>
            <label htmlFor="companyName" className={styles.label}>Unternehmensname</label>
            <input
              id="companyName"
              type="text"
              className={styles.input}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              autoComplete="organization"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="street" className={styles.label}>Straße und Hausnummer</label>
            <input
              id="street"
              type="text"
              className={styles.input}
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              autoComplete="street-address"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="postalCode" className={styles.label}>PLZ</label>
            <input
              id="postalCode"
              type="text"
              className={styles.input}
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              autoComplete="postal-code"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="city" className={styles.label}>Stadt</label>
            <input
              id="city"
              type="text"
              className={styles.input}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              autoComplete="address-level2"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="country" className={styles.label}>Land</label>
            <select
              id="country"
              className={styles.input}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              <option value="">— bitte wählen —</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="website-url" className={styles.label}>Website</label>
            <input
              id="website-url"
              type="url"
              className={styles.input}
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              autoComplete="url"
              placeholder="https://"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="phone-number-2" className={styles.label}>Telefon (Unternehmen)</label>
            <input
              id="phone-number-2"
              type="tel"
              className={styles.input}
              value={phoneNumber2}
              onChange={(e) => setPhoneNumber2(e.target.value)}
              autoComplete="tel"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="tax-id" className={styles.label}>Steuernummer / UID</label>
            <input
              id="tax-id"
              type="text"
              className={styles.input}
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder="z. B. 12/345/67890 oder CHE-123.456.789"
            />
            <span className={styles.fieldHint}>
              Steuernummer für deutsche Unternehmen; UID (CHE-… / FL-…) für die Schweiz und Liechtenstein.
            </span>
          </div>
          <div className={styles.field}>
            <label htmlFor="vat-eu" className={styles.label}>USt-IdNr. / VAT-EU</label>
            <input
              id="vat-eu"
              type="text"
              className={styles.input}
              value={vatEu}
              onChange={(e) => setVatEu(e.target.value)}
              placeholder="z. B. DE123456789 oder ATU12345678"
            />
            <span className={styles.fieldHint}>
              Umsatzsteuer-Identifikationsnummer für EU-Unternehmen (DE, AT, BE, NL usw.).
              Nicht anwendbar für die Schweiz und Liechtenstein.
            </span>
          </div>
          <button type="submit" className={styles.button} disabled={isCompanySubmitting}>
            {isCompanySubmitting ? "Wird gespeichert…" : "Aktualisieren"}
          </button>
        </form>
      </section>

      {/* Social Media */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Social Media</h2>
        {socialErrors.general && <p className={styles.errorMessage}>{socialErrors.general}</p>}
        {socialSuccess && <p className={styles.successMessage}>Social-Media-Links erfolgreich aktualisiert.</p>}
        <form onSubmit={handleSocialUpdate} className={styles.form} noValidate>
          <div className={styles.field}>
            <label htmlFor="instagram-url" className={styles.label}>Instagram</label>
            <input id="instagram-url" type="url" className={styles.input} value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/..." autoComplete="off" />
          </div>
          <div className={styles.field}>
            <label htmlFor="facebook-url" className={styles.label}>Facebook</label>
            <input id="facebook-url" type="url" className={styles.input} value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} placeholder="https://facebook.com/..." autoComplete="off" />
          </div>
          <div className={styles.field}>
            <label htmlFor="tiktok-url" className={styles.label}>TikTok</label>
            <input id="tiktok-url" type="url" className={styles.input} value={tiktokUrl} onChange={(e) => setTiktokUrl(e.target.value)} placeholder="https://tiktok.com/@..." autoComplete="off" />
          </div>
          <div className={styles.field}>
            <label htmlFor="youtube-url" className={styles.label}>YouTube</label>
            <input id="youtube-url" type="url" className={styles.input} value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/..." autoComplete="off" />
          </div>
          <button type="submit" className={styles.button} disabled={isSocialSubmitting}>
            {isSocialSubmitting ? "Wird gespeichert…" : "Aktualisieren"}
          </button>
        </form>
      </section>

      {/* Konto löschen */}
      <section className={`${styles.section} ${styles.dangerZone}`}>
        <h2 className={styles.sectionTitleDanger}>Konto löschen</h2>
        <p className={styles.dangerText}>
          Diese Aktion ist <strong>unwiderruflich</strong>. Alle Ihre Daten werden dauerhaft gelöscht.
        </p>
        {deleteError && <p className={styles.errorMessage}>{deleteError}</p>}
        <div className={styles.field}>
          <label htmlFor="delete-confirm" className={styles.label}>
            Geben Sie <strong>LÖSCHEN</strong> ein, um fortzufahren:
          </label>
          <input
            id="delete-confirm"
            type="text"
            className={styles.input}
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            autoComplete="off"
          />
        </div>
        <button
          type="button"
          onClick={handleDeleteAccount}
          disabled={isDeleting}
          className={styles.buttonDanger}
        >
          {isDeleting ? "Wird gelöscht…" : "Konto unwiderruflich löschen"}
        </button>
      </section>
    </div>
  );
}
