"use client";

import { useRef, useState } from "react";
import { Download } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  AUDIO_GUIDE_PDF,
  fetchMapboxGeoSuggestions,
  MAX_BESCHREIBUNG,
  parseMapboxSuggestion,
  uploadToDirectus,
  type GeocodingSuggestion,
} from "@/utils/pinFormHelpers";
import type { RedaktionPageContent } from "@/types";
import styles from "./redaktion.module.css";

// Fallback-Texte, jesli Directus nie zwraca contentu.
const DEFAULTS = {
  title: "Redaktion",
  subtitle:
    "Kennst du eine besondere Sehenswürdigkeit, die auf unsere Karte gehört? Als Teil unserer Redaktion kannst du selbst einen vollständigen Audiopin für die Kategorie **Sehenswertes** erstellen — kostenlos und unbegrenzt.",
  label_name: "Name des PINs",
  label_adresse: "Straße & Hausnummer",
  label_stadt: "Stadt",
  label_land: "Land",
  label_beschreibung: "Beschreibung",
  hint_beschreibung_audio:
    "Die Beschreibung ist der Text zu deinem Audiopin und sollte möglichst dem Inhalt deiner Audiodatei entsprechen. So können Besucher*innen die Geschichte während des Anhörens mitlesen oder sie alternativ lesen.",
  label_titelbild: "Titelbild",
  label_audio: "Audiodatei",
  label_galerie: "Galerie (max. 6 Bilder)",
  hint_moderation:
    "Alle eingereichten Pins werden vor der Veröffentlichung von unserem Team geprüft.",
  button_text: "Einreichen",
  button_sending_text: "Wird gesendet…",
  success_message:
    "Vielen Dank! Dein Pin wurde eingereicht und wird nun redaktionell geprüft.",
  error_message: "Ein Fehler ist aufgetreten. Bitte versuche es erneut.",
};

export default function RedaktionForm({
  content,
}: {
  content?: RedaktionPageContent | null;
}) {
  const { user } = useAuth();
  const t = {
    title: content?.title || DEFAULTS.title,
    subtitle: content?.subtitle || DEFAULTS.subtitle,
    label_name: content?.label_name || DEFAULTS.label_name,
    label_adresse: content?.label_adresse || DEFAULTS.label_adresse,
    label_stadt: content?.label_stadt || DEFAULTS.label_stadt,
    label_land: content?.label_land || DEFAULTS.label_land,
    label_beschreibung:
      content?.label_beschreibung || DEFAULTS.label_beschreibung,
    hint_beschreibung_audio:
      content?.hint_beschreibung_audio || DEFAULTS.hint_beschreibung_audio,
    label_titelbild: content?.label_titelbild || DEFAULTS.label_titelbild,
    label_audio: content?.label_audio || DEFAULTS.label_audio,
    label_galerie: content?.label_galerie || DEFAULTS.label_galerie,
    hint_moderation: content?.hint_moderation || DEFAULTS.hint_moderation,
    button_text: content?.button_text || DEFAULTS.button_text,
    button_sending_text:
      content?.button_sending_text || DEFAULTS.button_sending_text,
    success_message: content?.success_message || DEFAULTS.success_message,
    error_message: content?.error_message || DEFAULTS.error_message,
  };

  // Form fields
  const [name, setName] = useState("");
  const [adresse, setAdresse] = useState("");
  const [stadt, setStadt] = useState("");
  const [land, setLand] = useState("");
  const [vollbeschreibung, setVollbeschreibung] = useState("");
  const [coordinates, setCoordinates] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Mapbox autocomplete
  const [geoQuery, setGeoQuery] = useState("");
  const [geoSuggestions, setGeoSuggestions] = useState<GeocodingSuggestion[]>(
    [],
  );
  const [geoLoading, setGeoLoading] = useState(false);
  const geoDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Uploads
  const [titelbildId, setTitelbildId] = useState<string | null>(null);
  const [titelbildPreview, setTitelbildPreview] = useState<string | null>(null);
  const [titelbildUploading, setTitelbildUploading] = useState(false);
  const [titelbildError, setTitelbildError] = useState<string | null>(null);
  const titelbildRef = useRef<HTMLInputElement>(null);

  const [audioId, setAudioId] = useState<string | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [audioUploading, setAudioUploading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLInputElement>(null);

  const [galerieIds, setGalerieIds] = useState<string[]>([]);
  const [galeriePreviews, setGaleriePreviews] = useState<string[]>([]);
  const [galerieUploading, setGalerieUploading] = useState(false);
  const [galerieError, setGalerieError] = useState<string | null>(null);
  const galerieRef = useRef<HTMLInputElement>(null);

  // Submit state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // ── Mapbox handlers ──
  function handleGeoQueryChange(value: string) {
    setGeoQuery(value);
    setAdresse(value);
    if (geoDebounceRef.current) clearTimeout(geoDebounceRef.current);
    geoDebounceRef.current = setTimeout(
      () =>
        fetchMapboxGeoSuggestions(
          value,
          setGeoSuggestions,
          setGeoLoading,
          "address,poi",
        ),
      300,
    );
  }

  function selectGeoSuggestion(s: GeocodingSuggestion) {
    const parsed = parseMapboxSuggestion(s);
    setAdresse(parsed.adresse);
    setGeoQuery(parsed.placeName);
    setCoordinates({ lat: parsed.lat, lng: parsed.lng });
    if (parsed.stadt) setStadt(parsed.stadt);
    if (parsed.land) setLand(parsed.land);
    setGeoSuggestions([]);
  }

  // ── Upload handlers ──
  async function handleTitelbildUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setTitelbildError(null);
    setTitelbildUploading(true);
    try {
      const id = await uploadToDirectus(file);
      setTitelbildId(id);
      setTitelbildPreview(URL.createObjectURL(file));
    } catch {
      setTitelbildError("Fehler beim Hochladen.");
    } finally {
      setTitelbildUploading(false);
      if (titelbildRef.current) titelbildRef.current.value = "";
    }
  }

  async function handleAudioUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioError(null);
    setAudioUploading(true);
    try {
      const id = await uploadToDirectus(file);
      setAudioId(id);
      setAudioPreview(URL.createObjectURL(file));
    } catch {
      setAudioError("Fehler beim Hochladen.");
    } finally {
      setAudioUploading(false);
      if (audioRef.current) audioRef.current.value = "";
    }
  }

  async function handleGalerieUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = 6 - galerieIds.length;
    if (remaining <= 0) {
      setGalerieError("Maximal 6 Bilder erlaubt.");
      return;
    }
    setGalerieError(null);
    setGalerieUploading(true);
    try {
      const newIds: string[] = [];
      const newPreviews: string[] = [];
      for (const file of files.slice(0, remaining)) {
        newIds.push(await uploadToDirectus(file));
        newPreviews.push(URL.createObjectURL(file));
      }
      setGalerieIds((p) => [...p, ...newIds]);
      setGaleriePreviews((p) => [...p, ...newPreviews]);
    } catch {
      setGalerieError("Fehler beim Hochladen.");
    } finally {
      setGalerieUploading(false);
      if (galerieRef.current) galerieRef.current.value = "";
    }
  }

  function removeGalerieItem(idx: number) {
    setGalerieIds((p) => p.filter((_, i) => i !== idx));
    setGaleriePreviews((p) => p.filter((_, i) => i !== idx));
  }

  // ── Submit ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Name ist erforderlich.";
    if (!adresse.trim()) errors.adresse = "Adresse ist erforderlich.";
    if (!stadt.trim()) errors.stadt = "Stadt ist erforderlich.";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/redaktion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Name: name.trim(),
          Adresse: adresse.trim(),
          Stadt: stadt.trim(),
          Land: land.trim() || null,
          Breite: coordinates?.lat ?? null,
          Lange: coordinates?.lng ?? null,
          Vollbeschreibung: vollbeschreibung.trim() || null,
          Titelbild: titelbildId ?? null,
          Audio: audioId ?? null,
          Galerie: galerieIds.length > 0 ? galerieIds : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? t.error_message);
        setIsSubmitting(false);
        return;
      }
      setSuccess(true);
      // Reset form
      setName("");
      setAdresse("");
      setStadt("");
      setLand("");
      setVollbeschreibung("");
      setCoordinates(null);
      setGeoQuery("");
      setTitelbildId(null);
      setTitelbildPreview(null);
      setAudioId(null);
      setAudioPreview(null);
      setGalerieIds([]);
      setGaleriePreviews([]);
    } catch {
      setSubmitError(t.error_message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!user) return null;

  if (success) {
    return (
      <div className={styles.wrapper}>
        <h1 className={styles.title}>{t.title}</h1>
        <div className={styles.successBox}>
          <p className={styles.successText}>{t.success_message}</p>
          <button
            type="button"
            className={styles.newPinBtn}
            onClick={() => setSuccess(false)}
          >
            Neuen Pin einreichen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>{t.title}</h1>
      <div
        className={styles.subtitle}
        // Markdown z Directus renderowany prosto — same paragrafy + bold.
        // Uzywamy dangerouslySetInnerHTML tylko dla contentu z Directus (trusted).
        dangerouslySetInnerHTML={{
          __html: t.subtitle
            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
            .replace(/\n{2,}/g, "</p><p>")
            .replace(/^/, "<p>")
            .replace(/$/, "</p>"),
        }}
      />

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        {submitError && <p className={styles.errorMessage}>{submitError}</p>}

        {/* Name — na gorze, poniewaz to najwazniejsze pole. */}
        <div className={styles.field}>
          <label htmlFor="name" className={styles.label}>
            {t.label_name}
          </label>
          <input
            id="name"
            type="text"
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
          {fieldErrors.name && (
            <p className={styles.fieldError}>{fieldErrors.name}</p>
          )}
        </div>

        {/* Adresse — Mapbox autocomplete */}
        <div className={styles.field}>
          <label htmlFor="geoQuery" className={styles.label}>
            {t.label_adresse}
          </label>
          <input
            id="geoQuery"
            type="text"
            className={styles.input}
            value={geoQuery}
            onChange={(e) => handleGeoQueryChange(e.target.value)}
            autoComplete="off"
          />
          {geoLoading && <p className={styles.hint}>Suche…</p>}
          {geoSuggestions.length > 0 && (
            <ul className={styles.suggestions}>
              {geoSuggestions.map((s, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className={styles.suggestionBtn}
                    onClick={() => selectGeoSuggestion(s)}
                  >
                    {s.place_name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {fieldErrors.adresse && (
            <p className={styles.fieldError}>{fieldErrors.adresse}</p>
          )}
        </div>

        {/* Stadt + Land — pod-pola */}
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="stadt" className={styles.label}>
              {t.label_stadt}
            </label>
            <input
              id="stadt"
              type="text"
              className={styles.input}
              value={stadt}
              onChange={(e) => setStadt(e.target.value)}
              autoComplete="off"
            />
            {fieldErrors.stadt && (
              <p className={styles.fieldError}>{fieldErrors.stadt}</p>
            )}
          </div>
          <div className={styles.field}>
            <label htmlFor="land" className={styles.label}>
              {t.label_land}
            </label>
            <input
              id="land"
              type="text"
              className={styles.input}
              value={land}
              onChange={(e) => setLand(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        {/* Beschreibung + Audio — celowo obok siebie, zeby bylo jasne, ze opis
            powinien odpowiadac tresci nagrania. */}
        <div className={styles.group}>
          <p className={styles.groupHint}>{t.hint_beschreibung_audio}</p>

          <div className={styles.field}>
            <label htmlFor="vollbeschreibung" className={styles.label}>
              {t.label_beschreibung}
            </label>
            <textarea
              id="vollbeschreibung"
              className={styles.textarea}
              value={vollbeschreibung}
              onChange={(e) =>
                setVollbeschreibung(e.target.value.slice(0, MAX_BESCHREIBUNG))
              }
              maxLength={MAX_BESCHREIBUNG}
              rows={10}
            />
            <div className={styles.charCounterRow}>
              <span className={styles.hint}>
                ca. 1.300 – 1.800 Zeichen inklusive Leerzeichen
              </span>
              <span
                className={`${styles.charCounter} ${
                  vollbeschreibung.length >= MAX_BESCHREIBUNG
                    ? styles.charCounterMax
                    : ""
                }`}
              >
                {vollbeschreibung.length} / {MAX_BESCHREIBUNG}
              </span>
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="audio" className={styles.label}>
              {t.label_audio}
            </label>
            {audioPreview ? (
              <audio
                src={audioPreview}
                controls
                className={styles.audioPreview}
              />
            ) : (
              <p className={styles.hint}>Noch keine Datei hochgeladen.</p>
            )}
            <input
              id="audio"
              ref={audioRef}
              type="file"
              accept="audio/*"
              onChange={handleAudioUpload}
              className={styles.fileInput}
            />
            <div className={styles.audioMetaRow}>
              <p className={styles.hint}>MP3, M4A, WAV — max. 50 MB</p>
              <a href={AUDIO_GUIDE_PDF} download className={styles.guideLink}>
                <Download size={15} aria-hidden="true" />
                Tipps für die Audiodatei
              </a>
            </div>
            {audioUploading && <p className={styles.hint}>Wird hochgeladen…</p>}
            {audioError && <p className={styles.fieldError}>{audioError}</p>}
          </div>
        </div>

        {/* Titelbild */}
        <div className={styles.field}>
          <label htmlFor="titelbild" className={styles.label}>
            {t.label_titelbild}
          </label>
          {titelbildPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={titelbildPreview}
              alt="Titelbild"
              className={styles.imagePreview}
            />
          ) : (
            <p className={styles.hint}>Noch kein Bild hochgeladen.</p>
          )}
          <input
            id="titelbild"
            ref={titelbildRef}
            type="file"
            accept="image/*"
            onChange={handleTitelbildUpload}
            className={styles.fileInput}
          />
          {titelbildUploading && (
            <p className={styles.hint}>Wird hochgeladen…</p>
          )}
          {titelbildError && (
            <p className={styles.fieldError}>{titelbildError}</p>
          )}
        </div>

        {/* Galerie */}
        <div className={styles.field}>
          <label htmlFor="galerie" className={styles.label}>
            {t.label_galerie}
          </label>
          {galeriePreviews.length > 0 && (
            <div className={styles.galleryGrid}>
              {galeriePreviews.map((preview, i) => (
                <div key={i} className={styles.galleryItem}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt={`Galerie ${i + 1}`}
                    className={styles.galleryImg}
                  />
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => removeGalerieItem(i)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {galerieIds.length < 6 && (
            <input
              id="galerie"
              ref={galerieRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleGalerieUpload}
              className={styles.fileInput}
            />
          )}
          {galerieUploading && <p className={styles.hint}>Wird hochgeladen…</p>}
          {galerieError && <p className={styles.fieldError}>{galerieError}</p>}
        </div>

        <button type="submit" className={styles.button} disabled={isSubmitting}>
          {isSubmitting ? t.button_sending_text : t.button_text}
        </button>

        <p className={styles.hintCentered}>{t.hint_moderation}</p>
      </form>
    </div>
  );
}
