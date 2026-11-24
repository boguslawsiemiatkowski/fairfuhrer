"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import type { CompanySize, TaxBucket } from "@/types/auth";
import paypalLogo from "@/public/paypal-logo-fair-fuehrer-guide.png";
import styles from "./PartnerSubscriptionForm.module.css";

const COMPANY_SIZE_OPTIONS: {
  value: CompanySize;
  label: string;
  description: string;
  priceNet: number;
}[] = [
  {
    value: "nonprofit",
    label: "Gemeinnützige Organisation",
    description: "NGO, Verein, ehrenamtliche Organisation",
    priceNet: 25,
  },
  {
    value: "micro",
    label: "Kleinstunternehmen",
    description: "bis 5 Mitarbeitende",
    priceNet: 50,
  },
  {
    value: "small",
    label: "Kleines Unternehmen",
    description: "bis 50 Mitarbeitende",
    priceNet: 100,
  },
  {
    value: "medium",
    label: "Mittleres Unternehmen",
    description: "bis 500 Mitarbeitende",
    priceNet: 200,
  },
];

const VAT_RATE = 0.19;

function formatEur(amount: number) {
  return amount.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

interface Props {
  initialCompanySize: CompanySize | null;
  taxBucket: TaxBucket;
  taxIdValue: string | null;
  isPremiumActive: boolean;
  premiumUntil: string | null;
}

export function PartnerSubscriptionForm({
  initialCompanySize,
  taxBucket,
  taxIdValue,
  isPremiumActive,
  premiumUntil,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Wykrywamy powrót z PayPal już podczas inicjalizacji stanu (również przy
  // przedłużaniu aktywnej subskrypcji), aby uniknąć synchronicznego wywołania
  // setStep("activating") wewnątrz useEffect.
  const isReturningFromPayPal =
    searchParams.get("success") === "true" &&
    Boolean(searchParams.get("subscription_id"));
  const isCancelledFromPayPal = searchParams.get("cancelled") === "true";

  // Zawsze startujemy od kroku 1, nawet gdy company_size jest już zapisane w
  // profilu — inaczej po powrocie na stronę (AGB, przełączenie zakładki)
  // użytkownik ląduje od razu w "Schritt 2 von 2" i nie wie, skąd się tam wziął.
  // Wyjątek: powrót z PayPal z `?cancelled=true` (gdy mamy już companySize) wraca od razu do kroku 2.
  const [step, setStep] = useState<"size" | "payment" | "active" | "activating">(
    isReturningFromPayPal
      ? "activating"
      : isCancelledFromPayPal && initialCompanySize
        ? "payment"
        : isPremiumActive
          ? "active"
          : "size"
  );
  const [companySize, setCompanySize] = useState<CompanySize | null>(initialCompanySize);
  const [savingSize, setSavingSize] = useState(false);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [error, setError] = useState<string | null>(
    isCancelledFromPayPal
      ? "Der Zahlungsvorgang bei PayPal wurde abgebrochen. Sie können es jederzeit erneut versuchen."
      : null
  );
  const [activatedUntil, setActivatedUntil] = useState<string | null>(null);

  // Po powrocie z PayPal z ?success=true aktywuj subskrypcję (również przy przedłużaniu aktywnej subskrypcji)
  useEffect(() => {
    const isSuccess = searchParams.get("success") === "true";
    const subscriptionId = searchParams.get("subscription_id");
    if (!isSuccess || !subscriptionId) return;

    fetch(`/api/paypal/activate-subscription?subscription_id=${encodeURIComponent(subscriptionId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setActivatedUntil(data.premium_until);
          setStep("active");
          // Odśwież Server Component żeby premium_until było aktualne
          router.replace("/konto/partner/premium");
          router.refresh();
        } else {
          setError(
            data.error === "Subscription not active"
              ? "Die Zahlung wurde noch nicht bestätigt. Bitte warten Sie einen Moment und laden Sie die Seite neu."
              : "Aktivierung fehlgeschlagen. Bitte wenden Sie sich an info@fairfuehrer.guide."
          );
          setStep("payment");
        }
      })
      .catch(() => {
        setError("Verbindungsfehler bei der Aktivierung. Bitte Seite neu laden.");
        setStep("payment");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedOption = COMPANY_SIZE_OPTIONS.find((o) => o.value === companySize);

  async function handleSaveSize() {
    if (!companySize) return;
    setSavingSize(true);
    setError(null);
    try {
      const res = await fetch("/api/partner/set-company-size", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_size: companySize }),
      });
      if (!res.ok) throw new Error();
      setStep("payment");
    } catch {
      setError("Fehler beim Speichern. Bitte versuchen Sie es erneut.");
    } finally {
      setSavingSize(false);
    }
  }

  async function handleStartPayment() {
    setLoadingPayment(true);
    setError(null);
    try {
      const res = await fetch("/api/paypal/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok || !data.approve_url) throw new Error(data.error ?? "");
      window.location.href = data.approve_url;
    } catch {
      setError("Verbindung zu PayPal fehlgeschlagen. Bitte versuchen Sie es erneut.");
      setLoadingPayment(false);
    }
  }

  // Aktywacja w toku — spinner
  if (step === "activating") {
    return (
      <div className={styles.activatingBox}>
        <span className={styles.activatingSpinner} aria-hidden="true" />
        <p className={styles.activatingText}>
          Zahlung wird bestätigt…
        </p>
      </div>
    );
  }

  // Stan aktywny
  if (step === "active") {
    const displayUntil = activatedUntil ?? premiumUntil;
    const until = displayUntil
      ? new Date(displayUntil).toLocaleDateString("de-DE", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : null;
    const justActivated = !!activatedUntil;

    return (
      <div className={styles.activeBox}>
        <span className={styles.activeIcon}>✓</span>
        <h3 className={styles.activeTitle}>Partner Pin — aktiv</h3>

        {justActivated && (
          <p className={styles.activeSuccess}>
            Herzlichen Glückwunsch! Ihre Partnerschaft ist jetzt aktiv.
            Eine Bestätigung wurde an Ihre E-Mail-Adresse gesendet.
          </p>
        )}

        {until && (
          <p className={styles.activeUntil}>
            Aktiv bis: <strong>{until}</strong>
          </p>
        )}

        <div className={styles.activeActions}>
          <Link href="/konto/partner/audiopin" className={styles.studioCtaButton}>
            Zum Partner-Pin Studio (Live-Vorschau &amp; Bearbeitung) →
          </Link>

          <button
            type="button"
            className={styles.renewButton}
            onClick={() => {
              setError(null);
              // Wielkość jest już zapisana — prosto do podsumowania. Krok 2 ma
              // przycisk „zurück", więc partner może ją tam zmienić.
              setStep(companySize ? "payment" : "size");
            }}
          >
            Partnerschaft um ein weiteres Jahr verlängern
          </button>
        </div>

        <p className={styles.activeHint}>
          Keine automatische Verlängerung — Ihre Partnerschaft gilt für 12
          Monate und endet nicht in einem versteckten Abo. Vor Ablauf erinnern
          wir Sie rechtzeitig, sodass Sie frei entscheiden können, ob Sie um ein
          weiteres Jahr verlängern möchten. Bei Fragen wenden Sie sich gerne an{" "}
          <a href="mailto:info@fairfuehrer.guide" className={styles.activeLink}>
            info@fairfuehrer.guide
          </a>
          .
        </p>
      </div>
    );
  }

  // Schritt 1: Unternehmensgröße
  if (step === "size") {
    return (
      <div className={styles.form}>
        <p className={styles.stepLabel}>Schritt 1 von 2</p>
        <h3 className={styles.stepTitle}>Wie groß ist Ihr Unternehmen?</h3>
        <p className={styles.stepHint}>
          Der Preis richtet sich nach der Größe Ihrer Organisation. Sie zahlen
          das, was für Sie passt — ganz im Geiste unserer gemeinsamen Werte.
        </p>

        <div className={styles.sizeOptions}>
          {COMPANY_SIZE_OPTIONS.map((option) => {
            const vatAmount = option.priceNet * VAT_RATE;
            const gross = option.priceNet + vatAmount;
            const isNettoBucket =
              taxBucket === "eu_reverse_charge" || taxBucket === "third_country";
            return (
              <button
                key={option.value}
                type="button"
                className={`${styles.sizeOption} ${
                  companySize === option.value ? styles.sizeOptionSelected : ""
                }`}
                onClick={() => setCompanySize(option.value)}
              >
                <div className={styles.sizeOptionLeft}>
                  <span className={styles.sizeOptionLabel}>{option.label}</span>
                  <span className={styles.sizeOptionDesc}>{option.description}</span>
                </div>
                <div className={styles.sizeOptionPriceBox}>
                  <span className={styles.sizeOptionPrice}>
                    {formatEur(option.priceNet)} / Jahr
                  </span>
                  <span className={styles.sizeOptionVat}>
                    {isNettoBucket
                      ? taxBucket === "eu_reverse_charge"
                        ? "netto (0% MwSt. — Reverse-Charge)"
                        : "netto (keine deutsche MwSt.)"
                      : `zzgl. 19% MwSt. (${formatEur(gross)} brutto)`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button
          type="button"
          className={styles.primaryButton}
          onClick={handleSaveSize}
          disabled={!companySize || savingSize}
        >
          {savingSize ? "Wird gespeichert…" : "Weiter zur Zahlung"}
        </button>
      </div>
    );
  }

  // Schritt 2: Zusammenfassung + PayPal
  const vatAmount = selectedOption ? selectedOption.priceNet * VAT_RATE : 0;
  const gross = selectedOption ? selectedOption.priceNet + vatAmount : 0;

  // Koszyk podatkowy pochodzi bezpośrednio z profilu partnera (również dla NGO/nonprofit:
  // organizacja spoza Niemiec z ważnym EU-USt-IdNr. lub z kraju trzeciego płaci stawkę netto bez 19% DE MwSt.)
  const effectiveBucket: TaxBucket = taxBucket;

  return (
    <div className={styles.form}>
      <button
        type="button"
        className={styles.backButton}
        onClick={() => setStep("size")}
        disabled={loadingPayment}
      >
        ← Zurück
      </button>

      <p className={styles.stepLabel}>Schritt 2 von 2</p>
      <h3 className={styles.stepTitle}>Jährliche Partnerschaft abschließen</h3>

      {selectedOption && (
        <div className={styles.summaryBox}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Kategorie</span>
            <span className={styles.summaryValue}>{selectedOption.label}</span>
          </div>

          {taxIdValue && (
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Steuer-ID</span>
              <span className={styles.summaryValue}>{taxIdValue}</span>
            </div>
          )}

          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Laufzeit</span>
            <span className={styles.summaryValue}>
              12 Monate (keine automatische Verlängerung)
            </span>
          </div>

          {/* EU Reverse-Charge: netto, kein VAT */}
          {effectiveBucket === "eu_reverse_charge" && (
            <>
              <div className={`${styles.summaryRow} ${styles.summaryRowTotal}`}>
                <span className={styles.summaryLabel}>Nettobetrag</span>
                <span className={styles.summaryValueBold}>{formatEur(selectedOption.priceNet)} / Jahr</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>MwSt.</span>
                <span className={styles.summaryValue}>0,00 € (Reverse-Charge-Verfahren)</span>
              </div>
            </>
          )}

          {/* Drittland / EEA: netto, kein DE-VAT */}
          {effectiveBucket === "third_country" && (
            <>
              <div className={`${styles.summaryRow} ${styles.summaryRowTotal}`}>
                <span className={styles.summaryLabel}>Nettobetrag</span>
                <span className={styles.summaryValueBold}>{formatEur(selectedOption.priceNet)} / Jahr</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>MwSt.</span>
                <span className={styles.summaryValue}>
                  Keine deutsche MwSt. — Leistungsort im Empfängerland
                </span>
              </div>
            </>
          )}

          {/* DE oder EU ohne VAT-ID: brutto mit 19% */}
          {(effectiveBucket === "de" || effectiveBucket === "eu_no_vat") && (
            <>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Nettobetrag</span>
                <span className={styles.summaryValue}>{formatEur(selectedOption.priceNet)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>MwSt. 19%</span>
                <span className={styles.summaryValue}>{formatEur(vatAmount)}</span>
              </div>
              <div className={`${styles.summaryRow} ${styles.summaryRowTotal}`}>
                <span className={styles.summaryLabel}>Gesamtbetrag</span>
                <span className={styles.summaryValueBold}>{formatEur(gross)} / Jahr</span>
              </div>
              {effectiveBucket === "eu_no_vat" && (
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}></span>
                  <span className={styles.summaryNote}>
                    Ohne gültige EU-USt-IdNr. wird deutsche MwSt. 19% berechnet.
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className={styles.paypalInfo}>
        <Image src={paypalLogo} alt="PayPal" height={24} unoptimized />
        <p className={styles.paypalInfoText}>
          Die Zahlung erfolgt sicher über PayPal. Sie werden zu PayPal
          weitergeleitet, um die Zahlung für 12 Monate zu autorisieren. Es gibt{" "}
          <strong>keine automatische Verlängerung</strong> — Ihre Partnerschaft
          endet nach einem Jahr automatisch, sofern Sie sie nicht selbst
          verlängern.
        </p>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <button
        type="button"
        className={styles.paypalButton}
        onClick={handleStartPayment}
        disabled={loadingPayment}
      >
        <Image src={paypalLogo} alt="PayPal" height={20} unoptimized />
        {loadingPayment ? "Wird weitergeleitet…" : "Mit PayPal bezahlen"}
      </button>
    </div>
  );
}
