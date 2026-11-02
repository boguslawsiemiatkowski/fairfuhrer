"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { updateEmail, updatePassword, deleteAccount } from "@/app/actions/auth";
import type { FormErrors } from "@/types/auth";
import PasswordInput from "@/components/PasswordInput";
import styles from "../../einstellungen/einstellungen.module.css";

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

export default function ReisenderEinstellungenPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwErrors, setPwErrors] = useState<FormErrors>({});
  const [pwSuccess, setPwSuccess] = useState(false);
  const [isPwSubmitting, setIsPwSubmitting] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();

  async function handleEmailChange(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(undefined);
    setEmailSuccess(false);
    if (!newEmail.trim()) {
      setEmailError("Bitte geben Sie eine neue E-Mail-Adresse ein.");
      return;
    }
    setIsEmailSubmitting(true);
    const result = await updateEmail(newEmail.trim());
    setIsEmailSubmitting(false);
    if (!result.success) {
      setEmailError(result.error);
      return;
    }
    setEmailSuccess(true);
    setNewEmail("");
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwErrors({});
    setPwSuccess(false);
    const pwError = validatePassword(password);
    if (pwError) { setPwErrors({ password: pwError }); return; }
    if (password !== confirmPassword) {
      setPwErrors({ confirmPassword: "Passwörter stimmen nicht überein." });
      return;
    }
    setIsPwSubmitting(true);
    const result = await updatePassword(password);
    setIsPwSubmitting(false);
    if (!result.success) { setPwErrors({ general: result.error }); return; }
    setPwSuccess(true);
    setPassword("");
    setConfirmPassword("");
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
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>E-Mail-Adresse ändern</h2>
        <p className={styles.currentValue}>Aktuelle Adresse: <strong>{user?.email}</strong></p>
        {emailError && <p className={styles.errorMessage}>{emailError}</p>}
        {emailSuccess && <p className={styles.successMessage}>Bestätigungslink wurde an Ihre neue Adresse gesendet.</p>}
        <form onSubmit={handleEmailChange} className={styles.form} noValidate>
          <div className={styles.field}>
            <label htmlFor="new-email" className={styles.label}>Neue E-Mail-Adresse</label>
            <input id="new-email" type="email" className={styles.input} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoComplete="email" />
          </div>
          <button type="submit" className={styles.button} disabled={isEmailSubmitting}>
            {isEmailSubmitting ? "Wird gesendet…" : "Ändern"}
          </button>
        </form>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Passwort ändern</h2>
        {pwErrors.general && <p className={styles.errorMessage}>{pwErrors.general}</p>}
        {pwSuccess && <p className={styles.successMessage}>Passwort erfolgreich geändert.</p>}
        <form onSubmit={handlePasswordChange} className={styles.form} noValidate>
          <div className={styles.field}>
            <label htmlFor="pw-new" className={styles.label}>Neues Passwort *</label>
            <PasswordInput id="pw-new" className={`${styles.input} ${pwErrors.password ? styles.inputError : ""}`} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            <span className={styles.fieldHint}>Mind. 8 Zeichen, ein Großbuchstabe, ein Kleinbuchstabe, eine Ziffer und ein Sonderzeichen.</span>
            {pwErrors.password && <span className={styles.fieldError}>{pwErrors.password}</span>}
          </div>
          <div className={styles.field}>
            <label htmlFor="pw-confirm" className={styles.label}>Passwort bestätigen *</label>
            <PasswordInput id="pw-confirm" className={`${styles.input} ${pwErrors.confirmPassword ? styles.inputError : ""}`} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
            {pwErrors.confirmPassword && <span className={styles.fieldError}>{pwErrors.confirmPassword}</span>}
          </div>
          <button type="submit" className={styles.button} disabled={isPwSubmitting}>
            {isPwSubmitting ? "Wird gespeichert…" : "Passwort aktualisieren"}
          </button>
        </form>
      </section>

      <section className={`${styles.section} ${styles.dangerZone}`}>
        <h2 className={styles.sectionTitleDanger}>Konto löschen</h2>
        <p className={styles.dangerText}>Diese Aktion ist <strong>unwiderruflich</strong>. Alle Ihre Daten werden dauerhaft gelöscht.</p>
        {deleteError && <p className={styles.errorMessage}>{deleteError}</p>}
        <div className={styles.field}>
          <label htmlFor="delete-confirm" className={styles.label}>Geben Sie <strong>LÖSCHEN</strong> ein, um fortzufahren:</label>
          <input id="delete-confirm" type="text" className={styles.input} value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} autoComplete="off" />
        </div>
        <button type="button" onClick={handleDeleteAccount} disabled={isDeleting} className={styles.buttonDanger}>
          {isDeleting ? "Wird gelöscht…" : "Konto unwiderruflich löschen"}
        </button>
      </section>
    </div>
  );
}
