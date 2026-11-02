"use client";

// ⚠️ AUF EIS GELEGT (2026-07-04): Community-Feature vorerst nicht umgesetzt
// (Entscheidung Frank — Aufwand/Kosten Rechtsberatung). Diese Komponente wird
// aktuell NIRGENDS gerendert (Imports in reisender/partner Profil sind
// auskommentiert). Nicht löschen — dient als fertiger Baustein, falls das
// Feature zurückkommt. DB-Felder profiles.bio / profiles.is_public bleiben.

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import styles from "@/app/(protected)/konto/profil/profil.module.css";

const BIO_MAX = 300;

/**
 * Community-Profil: Bio + Sichtbarkeits-Schalter.
 * Wird sowohl im Reisenden- als auch im Partner-Profil eingebunden.
 */
export default function CommunityProfilSection() {
  const { user, refreshUser } = useAuth();
  const profile = user?.profile;

  // Przechowujemy jedynie lokalną wersję roboczą (draft) oraz optymistyczny stan przełącznika.
  // Dzięki temu unikamy synchronizowania stanu przez useEffect (reguła react-hooks/set-state-in-effect).
  const [bioDraft, setBioDraft] = useState<string | null>(null);
  const [optimisticIsPublic, setOptimisticIsPublic] = useState<boolean | null>(null);
  const [savingBio, setSavingBio] = useState(false);
  const [bioSaved, setBioSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bio = bioDraft ?? profile?.bio ?? "";
  const isPublic = optimisticIsPublic ?? profile?.is_public ?? false;
  const bioDirty = bio.trim() !== (profile?.bio ?? "").trim();

  async function handleSaveBio() {
    if (!user || !bioDirty) return;
    setError(null);
    setBioSaved(false);
    setSavingBio(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: err } = await supabase
        .from("profiles")
        .update({ bio: bio.trim() || null })
        .eq("id", user.id);
      if (err) throw err;
      await refreshUser();
      setBioDraft(null);
      setBioSaved(true);
    } catch (err) {
      console.error(err);
      setError("Die Beschreibung konnte nicht gespeichert werden.");
    } finally {
      setSavingBio(false);
    }
  }

  async function handleToggleVisibility() {
    if (!user) return;
    const next = !isPublic;
    setOptimisticIsPublic(next); // optymistyczna zmiana w UI
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: err } = await supabase
        .from("profiles")
        .update({ is_public: next })
        .eq("id", user.id);
      if (err) throw err;
      await refreshUser();
      setOptimisticIsPublic(null);
    } catch (err) {
      console.error(err);
      setOptimisticIsPublic(null);
      setError("Die Sichtbarkeit konnte nicht geändert werden.");
    }
  }

  return (
    <div className={styles.communitySection}>
      <p className={styles.sectionLabel}>Community-Profil</p>

      {/* Bio */}
      <div className={styles.bioBlock}>
        <label className={styles.bioLabel} htmlFor="bio">
          Über mich
        </label>
        <p className={styles.avatarText}>
          Eine kurze Beschreibung, die andere in der Community sehen, wenn dein
          Profil sichtbar ist.
        </p>
        <textarea
          id="bio"
          className={styles.bioInput}
          value={bio}
          maxLength={BIO_MAX}
          rows={4}
          placeholder="Erzähle etwas über dich…"
          onChange={(e) => {
            setBioDraft(e.target.value);
            setBioSaved(false);
          }}
        />
        <div className={styles.bioFooter}>
          <span className={styles.bioCount}>
            {bio.length}/{BIO_MAX}
          </span>
          <div className={styles.bioActions}>
            {bioSaved && !bioDirty && (
              <span className={styles.savedHint}>Gespeichert ✓</span>
            )}
            <button
              type="button"
              className={styles.uploadButton}
              onClick={handleSaveBio}
              disabled={!bioDirty || savingBio}
            >
              {savingBio ? "Wird gespeichert…" : "Speichern"}
            </button>
          </div>
        </div>
      </div>

      {/* Sichtbarkeit */}
      <div className={styles.visibilityRow}>
        <div className={styles.visibilityText}>
          <span className={styles.visibilityTitle}>
            Profil in der Community sichtbar
          </span>
          <span className={styles.visibilityHint}>
            {isPublic
              ? "Dein Profil ist für andere sichtbar."
              : "Dein Profil ist privat und für niemanden sichtbar."}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isPublic}
          aria-label="Profil in der Community sichtbar"
          className={`${styles.toggle} ${isPublic ? styles.toggleOn : ""}`}
          onClick={handleToggleVisibility}
        >
          <span className={styles.toggleKnob} />
        </button>
      </div>
      {error && <p className={styles.uploadError}>{error}</p>}
    </div>
  );
}
