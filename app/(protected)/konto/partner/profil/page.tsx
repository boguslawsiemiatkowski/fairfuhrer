"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getCountryLabel } from "@/lib/countries";
// Community-Feature auf Eis gelegt (2026-07-04): Frank hat entschieden, das
// Community-Feature vorerst nicht umzusetzen (Aufwand/Kosten Rechtsberatung).
// Komponente + DB-Felder (profiles.bio, is_public) bleiben erhalten, nur aus
// der UI genommen. Zum Reaktivieren: Import + <CommunityProfilSection/> unten
// wieder einkommentieren. Siehe auch Reisenden-Profil (gleiche Stelle).
// import CommunityProfilSection from "@/components/auth/CommunityProfilSection";
import styles from "@/app/(protected)/konto/profil/profil.module.css";

export default function PartnerProfilPage() {
  const { user, logout } = useAuth();
  const profile = user?.profile;
  const partner = user?.partnerProfile;

  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.headerCard}>
        <div className={styles.headerCardLeft}>
          <span className={styles.headerCardKicker}>Partner-Konto</span>
          <h2 className={styles.headerCardTitle}>Profil-Übersicht</h2>
        </div>
        <Link
          href="/konto/partner/einstellungen"
          className={styles.headerCardAction}
        >
          Daten bearbeiten →
        </Link>
      </div>

      {/* Community-Feature auf Eis gelegt (2026-07-04) — s. Import oben. */}
      {/* <CommunityProfilSection /> */}

      {/* Unternehmensdaten */}
      <div className={styles.fields}>
        <div className={styles.sectionLabel}>Unternehmensdaten</div>
        <div className={styles.field}>
          <span className={styles.label}>Unternehmensname</span>
          <span className={styles.value}>{partner?.company_name || "—"}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Straße und Hausnummer</span>
          <span className={styles.value}>{partner?.street || "—"}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>PLZ</span>
          <span className={styles.value}>{partner?.postal_code || "—"}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Stadt</span>
          <span className={styles.value}>{partner?.city || "—"}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Land</span>
          <span className={styles.value}>{getCountryLabel(partner?.country)}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Website</span>
          <span className={styles.value}>{partner?.website_url || "—"}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Telefon (Unternehmen)</span>
          <span className={styles.value}>{partner?.phone_number_2 || "—"}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Steuernummer / UID</span>
          <span className={styles.value}>{partner?.tax_id || "—"}</span>
        </div>
        <div className={`${styles.field} ${styles.fieldFull}`}>
          <span className={styles.label}>USt-IdNr. / VAT-EU</span>
          <span className={styles.value}>{partner?.vat_eu || "—"}</span>
        </div>
      </div>

      {/* Social Media */}
      <div className={styles.fields}>
        <div className={styles.sectionLabel}>Social Media</div>
        <div className={styles.field}>
          <span className={styles.label}>Instagram</span>
          <span className={styles.value}>{partner?.instagram_url || "—"}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Facebook</span>
          <span className={styles.value}>{partner?.facebook_url || "—"}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>TikTok</span>
          <span className={styles.value}>{partner?.tiktok_url || "—"}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>YouTube</span>
          <span className={styles.value}>{partner?.youtube_url || "—"}</span>
        </div>
      </div>

      {/* Kontaktdaten */}
      <div className={styles.fields}>
        <div className={styles.sectionLabel}>Kontaktdaten</div>
        <div className={styles.field}>
          <span className={styles.label}>Vorname</span>
          <span className={styles.value}>{profile?.first_name || "—"}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Nachname</span>
          <span className={styles.value}>{profile?.last_name || "—"}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Kontakt-E-Mail</span>
          <span className={styles.value}>{partner?.business_email || "—"}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Telefon</span>
          <span className={styles.value}>{partner?.phone_number || "—"}</span>
        </div>
      </div>

      {/* Zugangsdaten */}
      <div className={styles.fields}>
        <div className={styles.sectionLabel}>Zugangsdaten</div>
        <div className={`${styles.field} ${styles.fieldFull}`}>
          <span className={styles.label}>Anmelde-E-Mail</span>
          <span className={styles.value}>{user?.email || "—"}</span>
        </div>
      </div>

      <div className={styles.signOutSection}>
        <p className={styles.signOutHint}>
          Du bist aktuell als Partner*in angemeldet.
        </p>
        <button
          type="button"
          className={styles.signOutButton}
          onClick={handleSignOut}
          disabled={signingOut}
        >
          {signingOut ? "Wird abgemeldet…" : "Abmelden"}
        </button>
      </div>
    </div>
  );
}
