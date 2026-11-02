import { getCurrentUser } from "@/app/actions/auth";
import { PartnerSubscriptionForm } from "@/components/PartnerSubscriptionForm";
import { getTaxBucket } from "@/lib/countries";
import { isPremiumActiveForDates, resolvePremiumUntil } from "@/types/auth";
import styles from "./premium.module.css";

export default async function PartnerPremiumPage() {
  const user = await getCurrentUser();

  const companySize = user?.profile?.company_size ?? null;
  const partner = user?.partnerProfile;

  // Ujednolicone sprawdzanie daty ważności Partner-Pin z obu tabel (profiles i partner_profiles)
  const premiumUntil = resolvePremiumUntil(
    user?.profile?.premium_until,
    partner?.premium_until,
  );
  const isPremiumActive = isPremiumActiveForDates(
    user?.profile?.premium_until,
    partner?.premium_until,
  );

  // Koszyk VAT z zapisanych danych profilu lub obliczony na bieżąco
  const taxBucket =
    partner?.tax_bucket ??
    getTaxBucket(partner?.country, !partner?.no_eu_vat && !!partner?.vat_eu);

  const taxIdValue = partner?.tax_id_value ?? partner?.vat_eu ?? partner?.tax_id ?? null;

  return (
    <div className={styles.wrapper}>
      <h3 className={styles.intro}>Partner PIN</h3>

      <div className={styles.featureList}>
        <h4 className={styles.featureTitle}>
          Das bekommst du mit dem Partner Pin:
        </h4>
        <ul className={styles.features}>
          <li>Sofortige Veröffentlichung ohne Wartezeit</li>
          <li>Jederzeit bearbeitbar</li>
          <li>Telefonnummer mit Anruf-Button</li>
          <li>Link zu Ihrer Website</li>
          <li>Bildergalerie mit bis zu 6 Fotos</li>
          <li>Hochladen eines eigenen Audiobeitrags</li>
          <li>Weitere Zertifizierungen & Labels</li>
        </ul>
      </div>

      <div className={styles.divider} />

      <PartnerSubscriptionForm
        initialCompanySize={companySize}
        taxBucket={taxBucket}
        taxIdValue={taxIdValue}
        isPremiumActive={isPremiumActive}
        premiumUntil={premiumUntil}
      />

      {!isPremiumActive && (
        <p className={styles.legalNote}>
          Mit dem Abschluss der Partnerschaft stimmen Sie unseren{" "}
          <a href="/agb" className={styles.legalLink}>
            Allgemeinen Geschäftsbedingungen
          </a>{" "}
          zu. Die Zahlung erfolgt jährlich und verlängert sich automatisch, bis
          Sie kündigen.
        </p>
      )}
    </div>
  );
}
