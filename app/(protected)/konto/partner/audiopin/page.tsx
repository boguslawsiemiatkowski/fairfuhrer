"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  AUDIO_GUIDE_PDF,
  fetchMapboxGeoSuggestions,
  MAX_BESCHREIBUNG,
  parseMapboxSuggestion,
  uploadToDirectus,
  type GeocodingSuggestion,
} from "@/utils/pinFormHelpers";
import styles from "./audiopin.module.css";

interface Option<T> {
  id: T;
  name: string;
}

interface GalerieItem {
  junctionId: number | string;
  fileId: string;
  preview: string;
  isNew?: boolean;
}

interface PinData {
  id: number;
  Name: string;
  Adresse: string;
  Stadt: string;
  Land: string | null;
  Telefon: string | null;
  Vollbeschreibung: string | null;
  Link_URL: string | null;
  Link_Text: string | null;
  Titelbild: string | null;
  Audio: string | null;
  location: { type: string; coordinates: [number, number] } | null;
  Galerie: { id: number; directus_files_id: string }[];
  Kategorie: { Kategorie_id: number }[];
  Zertifizierungen: { Zertifizierungen_id: string }[];
}

// Proxy przez nasz API dla plików wymagających autoryzacji (galeria, titelbild, audio partnera)
function assetUrl(uuid: string) {
  return `/api/asset/${uuid}`;
}

export default function AudiopinPage() {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [premiumChecked, setPremiumChecked] = useState(false);

  // Kategorie i certyfikaty pochodza z Directusa (api/pin-optionen), zeby
  // formularz nie rozjezdzal sie z CMS przy kazdej zmianie nazwy.
  const [kategorienOptions, setKategorienOptions] = useState<Option<number>[]>(
    [],
  );
  const [zertOptions, setZertOptions] = useState<Option<string>[]>([]);

  // Tryby strony
  type PageMode = "loading" | "new_form" | "view" | "submitting";
  const [mode, setMode] = useState<PageMode>("loading");
  const [pinId, setPinId] = useState<number | null>(null);
  const [pinData, setPinData] = useState<PinData | null>(null);
  const [pinLoading, setPinLoading] = useState(false);

  // Które pola są w trybie edycji (per-field)
  const [editingFields, setEditingFields] = useState<Set<string>>(new Set());
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());
  const [fieldSaveErrors, setFieldSaveErrors] = useState<
    Record<string, string>
  >({});
  const [fieldSaveSuccess, setFieldSaveSuccess] = useState<
    Record<string, boolean>
  >({});

  // Wartości edytowanych pól (lokalne kopie)
  const [editValues, setEditValues] = useState<Record<string, unknown>>({});

  // Galerie edycja
  const [galerieItems, setGalerieItems] = useState<GalerieItem[]>([]);
  const [galerieUploading, setGalerieUploading] = useState(false);
  const [galerieError, setGalerieError] = useState<string | null>(null);
  const galerieRef = useRef<HTMLInputElement>(null);

  // Geocoding (tylko przy edycji adresu)
  const [geoSuggestions, setGeoSuggestions] = useState<GeocodingSuggestion[]>(
    [],
  );
  const [geoLoading, setGeoLoading] = useState(false);
  const geoDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Nowy formularz (gdy brak pina)
  const [adresse, setAdresse] = useState("");
  const [stadt, setStadt] = useState("");
  const [land, setLand] = useState("");
  const [coordinates, setCoordinates] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [geoQuery, setGeoQuery] = useState("");
  const [geoSuggestionsNew, setGeoSuggestionsNew] = useState<
    GeocodingSuggestion[]
  >([]);
  const [geoLoadingNew, setGeoLoadingNew] = useState(false);
  const geoDebounceNewRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [name, setName] = useState("");
  const [telefon, setTelefon] = useState("");
  const [vollbeschreibung, setVollbeschreibung] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [kategorien, setKategorien] = useState<number[]>([]);
  const [zertifizierungen, setZertifizierungen] = useState<string[]>([]);
  const [titelbildId, setTitelbildId] = useState<string | null>(null);
  const [titelbildPreview, setTitelbildPreview] = useState<string | null>(null);
  const [titelbildUploading, setTitelbildUploading] = useState(false);
  const [titelbildError, setTitelbildError] = useState<string | null>(null);
  const titelbildRef = useRef<HTMLInputElement>(null);
  const [galerieIds, setGalerieIds] = useState<string[]>([]);
  const [galeriePreviews, setGaleriePreviews] = useState<string[]>([]);
  const [galerieUploadingNew, setGalerieUploadingNew] = useState(false);
  const [galerieErrorNew, setGalerieErrorNew] = useState<string | null>(null);
  const galerieRefNew = useRef<HTMLInputElement>(null);
  const [audioId, setAudioId] = useState<string | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [audioUploading, setAudioUploading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Załaduj listy kategorii i certyfikatów z Directusa
  useEffect(() => {
    fetch("/api/pin-optionen")
      .then((r) => r.json())
      .then((data) => {
        setKategorienOptions(data.kategorien ?? []);
        setZertOptions(data.zertifizierungen ?? []);
      })
      .catch(() => {});
  }, []);

  // Załaduj status premium i pin_id
  useEffect(() => {
    if (!user) return;
    const supabase = getSupabaseBrowserClient();
    supabase
      .from("partner_profiles")
      .select("premium_until, pin_id")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        const premium = data?.premium_until
          ? new Date(data.premium_until) > new Date()
          : false;
        setIsPremium(premium);
        if (data?.pin_id) {
          setPinId(data.pin_id);
          // Ustawiamy stan ładowania już przy przejściu w tryb "view",
          // aby uniknąć synchronicznego setState wewnątrz useEffect.
          setPinLoading(true);
          setMode("view");
        } else {
          setMode("new_form");
        }
        setPremiumChecked(true);
      });
  }, [user]);

  // Załaduj dane pina gdy tryb view
  useEffect(() => {
    if (mode !== "view" || !pinId) return;
    fetch(`/api/audiopin/${pinId}`)
      .then(async (r) => {
        // Pin usuniety w Directusie (np. po odrzuceniu zgloszenia), a pin_id
        // wciaz w partner_profiles — bez tego konto zostaje z formularzem
        // w trybie edycji, ktorej nie da sie wykonac, i nowego pina tez nie
        // mozna dodac. Traktujemy brak pina jak jego brak w profilu.
        if (r.status === 404 || r.status === 403) {
          setPinId(null);
          setPinData(null);
          setGalerieItems([]);
          setMode("new_form");
          return null;
        }
        if (!r.ok) throw new Error(`Pin konnte nicht geladen werden (${r.status})`);
        return (await r.json()) as PinData;
      })
      .then((data) => {
        if (!data) return;
        setPinData(data);
        const items = (data.Galerie ?? []).map((g) => ({
          junctionId: g.id,
          fileId: g.directus_files_id,
          preview: assetUrl(g.directus_files_id),
        }));
        setGalerieItems(items);
      })
      .catch(() => {})
      .finally(() => setPinLoading(false));
  }, [mode, pinId]);

  // ======== Helpers per-field edit ========

  function startEdit(field: string, currentValue: unknown) {
    setEditingFields((prev) => new Set(prev).add(field));
    setEditValues((prev) => ({ ...prev, [field]: currentValue }));
    setFieldSaveErrors((prev) => {
      const n = { ...prev };
      delete n[field];
      return n;
    });
    setFieldSaveSuccess((prev) => {
      const n = { ...prev };
      delete n[field];
      return n;
    });
  }

  function cancelEdit(field: string) {
    setEditingFields((prev) => {
      const n = new Set(prev);
      n.delete(field);
      return n;
    });
    setEditValues((prev) => {
      const n = { ...prev };
      delete n[field];
      return n;
    });
  }

  async function saveField(field: string, value: unknown) {
    if (!pinId) return;
    setSavingFields((prev) => new Set(prev).add(field));
    setFieldSaveErrors((prev) => {
      const n = { ...prev };
      delete n[field];
      return n;
    });
    try {
      // Specjalne przypadki wymagające dodatkowych danych
      let payload: Record<string, unknown>;
      if (field === "adresse_group") {
        payload = {
          Adresse: editValues.Adresse,
          Stadt: editValues.Stadt,
          Land: editValues.Land,
          ...(editValues.location ? { location: editValues.location } : {}),
        };
      } else if (field === "Kategorie") {
        const currentIds = (pinData?.Kategorie ?? []).map(
          (k) => k.Kategorie_id,
        );
        payload = {
          Kategorie: value,
          Kategorie_delete: currentIds,
        };
      } else if (field === "Zertifizierungen") {
        const currentIds = (pinData?.Zertifizierungen ?? []).map(
          (z) => z.Zertifizierungen_id,
        );
        payload = {
          Zertifizierungen: value,
          Zertifizierungen_delete: currentIds,
        };
      } else {
        payload = { [field]: value };
      }

      const res = await fetch(`/api/audiopin/${pinId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setFieldSaveErrors((prev) => ({
          ...prev,
          [field]: data.error ?? "Fehler.",
        }));
        return;
      }
      // Aktualizuj lokalne dane pina
      if (field === "adresse_group") {
        setPinData((prev) =>
          prev
            ? {
                ...prev,
                Adresse: (editValues.Adresse as string) ?? prev.Adresse,
                Stadt: (editValues.Stadt as string) ?? prev.Stadt,
                Land: (editValues.Land as string) ?? prev.Land,
              }
            : prev,
        );
      } else if (field === "Kategorie") {
        setPinData((prev) =>
          prev
            ? {
                ...prev,
                Kategorie: (value as number[]).map((id) => ({
                  Kategorie_id: id,
                })),
              }
            : prev,
        );
      } else if (field === "Zertifizierungen") {
        setPinData((prev) =>
          prev
            ? {
                ...prev,
                Zertifizierungen: (value as string[]).map((id) => ({
                  Zertifizierungen_id: id,
                })),
              }
            : prev,
        );
      } else {
        setPinData((prev) => (prev ? { ...prev, [field]: value } : prev));
      }
      setFieldSaveSuccess((prev) => ({ ...prev, [field]: true }));
      setEditingFields((prev) => {
        const n = new Set(prev);
        n.delete(field);
        return n;
      });
      setTimeout(
        () =>
          setFieldSaveSuccess((prev) => {
            const n = { ...prev };
            delete n[field];
            return n;
          }),
        3000,
      );
    } catch {
      setFieldSaveErrors((prev) => ({ ...prev, [field]: "Netzwerkfehler." }));
    } finally {
      setSavingFields((prev) => {
        const n = new Set(prev);
        n.delete(field);
        return n;
      });
    }
  }

  // ======== Geocoding (wspólne helpery z utils/pinFormHelpers.ts) ========

  function handleGeoQueryChange(value: string) {
    setGeoQuery(value);
    if (geoDebounceNewRef.current) clearTimeout(geoDebounceNewRef.current);
    geoDebounceNewRef.current = setTimeout(
      () =>
        fetchMapboxGeoSuggestions(
          value,
          setGeoSuggestionsNew,
          setGeoLoadingNew,
          "address,place",
        ),
      300,
    );
  }

  function selectGeoSuggestion(suggestion: GeocodingSuggestion) {
    const parsed = parseMapboxSuggestion(suggestion);
    setCoordinates({ lat: parsed.lat, lng: parsed.lng });
    setAdresse(parsed.adresse);
    if (parsed.stadt) setStadt(parsed.stadt);
    if (parsed.land) setLand(parsed.land);
    setGeoQuery(parsed.placeName);
    setGeoSuggestionsNew([]);
  }

  // Edycja adresu (per-field)
  function handleEditGeoQueryChange(value: string) {
    setEditValues((prev) => ({ ...prev, geoQuery: value, Adresse: value }));
    if (geoDebounceRef.current) clearTimeout(geoDebounceRef.current);
    geoDebounceRef.current = setTimeout(
      () =>
        fetchMapboxGeoSuggestions(
          value,
          setGeoSuggestions,
          setGeoLoading,
          "address,place",
        ),
      300,
    );
  }

  function selectEditGeoSuggestion(suggestion: GeocodingSuggestion) {
    const parsed = parseMapboxSuggestion(suggestion);
    setEditValues((prev) => ({
      ...prev,
      geoQuery: parsed.placeName,
      Adresse: parsed.adresse,
      Stadt: parsed.stadt ?? prev.Stadt,
      Land: parsed.land ?? prev.Land,
      location: { type: "Point", coordinates: [parsed.lng, parsed.lat] },
    }));
    setGeoSuggestions([]);
  }

  // ======== Upload helpers ========

  function toggleMulti<T>(list: T[], value: T): T[] {
    return list.includes(value)
      ? list.filter((v) => v !== value)
      : [...list, value];
  }

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

  async function handleGalerieUploadNew(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = 6 - galerieIds.length;
    if (remaining <= 0) {
      setGalerieErrorNew("Maximal 6 Bilder erlaubt.");
      return;
    }
    setGalerieErrorNew(null);
    setGalerieUploadingNew(true);
    try {
      const newIds: string[] = [],
        newPreviews: string[] = [];
      for (const file of files.slice(0, remaining)) {
        newIds.push(await uploadToDirectus(file));
        newPreviews.push(URL.createObjectURL(file));
      }
      setGalerieIds((p) => [...p, ...newIds]);
      setGaleriePreviews((p) => [...p, ...newPreviews]);
    } catch {
      setGalerieErrorNew("Fehler beim Hochladen.");
    } finally {
      setGalerieUploadingNew(false);
      if (galerieRefNew.current) galerieRefNew.current.value = "";
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

  // Upload dla galerii w trybie edycji
  async function handleGalerieEditUpload(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = 6 - galerieItems.length;
    if (remaining <= 0) {
      setGalerieError("Maximal 6 Bilder erlaubt.");
      return;
    }
    setGalerieError(null);
    setGalerieUploading(true);
    try {
      const newItems: GalerieItem[] = [];
      for (const file of files.slice(0, remaining)) {
        const fileId = await uploadToDirectus(file);
        newItems.push({
          junctionId: `new-${fileId}`,
          fileId,
          preview: URL.createObjectURL(file),
          isNew: true,
        });
      }
      const updated = [...galerieItems, ...newItems];
      setGalerieItems(updated);
      // Natychmiastowy zapis nowych zdjęć
      const patchRes = await fetch(`/api/audiopin/${pinId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Galerie_add: newItems.map((i) => i.fileId) }),
      });
      if (patchRes.ok) {
        // Odśwież przez GET żeby dostać aktualne junction IDs
        const getRes = await fetch(`/api/audiopin/${pinId}`);
        if (getRes.ok) {
          const freshData = (await getRes.json()) as PinData;
          setGalerieItems(
            (freshData.Galerie ?? []).map((g) => ({
              junctionId: g.id,
              fileId: g.directus_files_id,
              preview: assetUrl(g.directus_files_id),
            })),
          );
        }
      }
    } catch {
      setGalerieError("Fehler beim Hochladen.");
    } finally {
      setGalerieUploading(false);
      if (galerieRef.current) galerieRef.current.value = "";
    }
  }

  async function removeGalerieItem(item: GalerieItem) {
    if (item.isNew) {
      setGalerieItems((prev) =>
        prev.filter((g) => g.junctionId !== item.junctionId),
      );
      return;
    }
    const res = await fetch(`/api/audiopin/${pinId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Galerie_delete: [item.junctionId] }),
    });
    if (res.ok) {
      setGalerieItems((prev) =>
        prev.filter((g) => g.junctionId !== item.junctionId),
      );
    }
  }

  // ======== Submit nowego pina ========

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setSubmitError(null);
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Name ist erforderlich.";
    if (!adresse.trim()) errors.adresse = "Adresse ist erforderlich.";
    if (!stadt.trim()) errors.stadt = "Stadt ist erforderlich.";
    if (kategorien.length === 0)
      errors.kategorien = "Bitte mindestens eine Kategorie wählen.";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setMode("submitting");
    try {
      const res = await fetch("/api/audiopin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Name: name.trim(),
          Adresse: adresse.trim(),
          Stadt: stadt.trim(),
          Land: land.trim() || null,
          Breite: coordinates?.lat ?? null,
          Lange: coordinates?.lng ?? null,
          Telefon: isPremium ? telefon.trim() || null : null,
          Vollbeschreibung: vollbeschreibung.trim() || null,
          Link_URL: isPremium ? linkUrl.trim() || null : null,
          Kategorie: kategorien,
          Zertifizierungen: zertifizierungen,
          Titelbild: titelbildId ?? null,
          Galerie: isPremium && galerieIds.length > 0 ? galerieIds : null,
          Audio: audioId ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Fehler.");
        setMode("new_form");
        return;
      }
      setPinId(data.id);
      setPinLoading(true);
      setMode("view");
    } catch {
      setSubmitError("Es ist ein Fehler aufgetreten.");
      setMode("new_form");
    }
  }

  if (!premiumChecked) return null;

  // ==============================
  // TRYB VIEW — per-field edycja
  // ==============================
  if (mode === "view") {
    if (pinLoading || !pinData) {
      return (
        <div className={styles.wrapper}>
          <p className={styles.hint}>Wird geladen…</p>
        </div>
      );
    }

    const kategorienIds = (pinData.Kategorie ?? []).map((k) => k.Kategorie_id);

    // Funkcja pomocnicza renderująca wiersz pola (zamiast zagnieżdżonego komponentu <FieldRow />),
    // aby React nie tworzył nowego typu komponentu przy każdym renderze i nie gubił fokusu w polach input.
    function renderFieldRow({
      field,
      label,
      value,
      renderEdit,
    }: {
      field: string;
      label: string;
      value: React.ReactNode;
      renderEdit: () => React.ReactNode;
    }) {
      const isEditing = editingFields.has(field);
      const isSaving = savingFields.has(field);
      const error = fieldSaveErrors[field];
      const success = fieldSaveSuccess[field];

      return (
        <div className={styles.viewField}>
          <div className={styles.viewFieldHeader}>
            <span className={styles.viewFieldLabel}>{label}</span>
            {isPremium && !isEditing && (
              <button
                type="button"
                className={styles.editFieldBtn}
                onClick={() =>
                  startEdit(
                    field,
                    editValues[field] ?? pinData?.[field as keyof PinData],
                  )
                }
              >
                Bearbeiten
              </button>
            )}
          </div>
          {isEditing ? (
            <div className={styles.viewFieldEdit}>
              {renderEdit()}
              {error && <p className={styles.fieldError}>{error}</p>}
              <div className={styles.viewFieldActions}>
                <button
                  type="button"
                  className={styles.saveFieldBtn}
                  disabled={isSaving}
                  onClick={() => saveField(field, editValues[field])}
                >
                  {isSaving ? "Speichern…" : "Speichern"}
                </button>
                <button
                  type="button"
                  className={styles.cancelFieldBtn}
                  onClick={() => cancelEdit(field)}
                  disabled={isSaving}
                >
                  Abbrechen
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.viewFieldValue}>
              {success && (
                <span className={styles.savedBadge}>✓ Gespeichert</span>
              )}
              {value || <span className={styles.viewFieldEmpty}>—</span>}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className={styles.wrapper}>
        <h3 className={styles.intro}>Dein Audiopin</h3>
        {!isPremium && (
          <p className={styles.freeAccountInfo}>
            Mit einem kostenlosen Konto kann der PIN nach der Einreichung nicht
            mehr bearbeitet werden. Mit dem{" "}
            <span className={styles.premiumBadge}>Partner PIN</span>
            kannst du jederzeit Änderungen vornehmen.
          </p>
        )}

        <div className={styles.viewBox}>
          {renderFieldRow({
            field: "Name",
            label: "Name des PINs",
            value: pinData.Name,
            renderEdit: () => (
              <input
                type="text"
                aria-label="Name des PINs"
                className={styles.input}
                value={(editValues.Name as string) ?? ""}
                onChange={(e) =>
                  setEditValues((p) => ({ ...p, Name: e.target.value }))
                }
                autoFocus
              />
            ),
          })}

          {renderFieldRow({
            field: "adresse_group",
            label: "Adresse",
            value: (
              <span>
                {pinData.Adresse || "—"}
                {pinData.Stadt ? (
                  <>
                    , <strong>{pinData.Stadt}</strong>
                  </>
                ) : null}
                {pinData.Land ? <> ({pinData.Land})</> : null}
              </span>
            ),
            renderEdit: () => (
              <div className={styles.geoWrapper}>
                <input
                  type="text"
                  aria-label="Adresse suchen"
                  className={styles.input}
                  value={
                    (editValues.geoQuery as string) ??
                    [pinData.Adresse, pinData.Stadt, pinData.Land]
                      .filter(Boolean)
                      .join(", ")
                  }
                  onChange={(e) => handleEditGeoQueryChange(e.target.value)}
                  onBlur={() => setTimeout(() => setGeoSuggestions([]), 150)}
                  placeholder="Straße, Stadt…"
                  autoComplete="off"
                  autoFocus
                />
                {geoLoading && (
                  <span className={styles.geoLoading}>Suche…</span>
                )}
                {geoSuggestions.length > 0 && (
                  <ul className={styles.geoDropdown}>
                    {geoSuggestions.map((s) => (
                      <li
                        key={s.place_name}
                        className={styles.geoDropdownItem}
                        onMouseDown={() => selectEditGeoSuggestion(s)}
                      >
                        {s.place_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ),
          })}

          {renderFieldRow({
            field: "Telefon",
            label: "Telefonnummer mit Anruffunktion",
            value: pinData.Telefon,
            renderEdit: () => (
              <input
                type="tel"
                aria-label="Telefonnummer mit Anruffunktion"
                className={styles.input}
                value={(editValues.Telefon as string) ?? ""}
                onChange={(e) =>
                  setEditValues((p) => ({ ...p, Telefon: e.target.value }))
                }
                autoFocus
              />
            ),
          })}

          {renderFieldRow({
            field: "Vollbeschreibung",
            label: "Vollständige Beschreibung",
            value: pinData.Vollbeschreibung ? (
              <span className={styles.viewFieldLong}>
                {pinData.Vollbeschreibung}
              </span>
            ) : null,
            renderEdit: () => {
              const value = (editValues.Vollbeschreibung as string) ?? "";
              return (
                <div className={styles.fieldGroup}>
                  <textarea
                    aria-label="Vollständige Beschreibung"
                    className={styles.textarea}
                    rows={10}
                    maxLength={MAX_BESCHREIBUNG}
                    value={value}
                    onChange={(e) =>
                      setEditValues((p) => ({
                        ...p,
                        Vollbeschreibung: e.target.value.slice(
                          0,
                          MAX_BESCHREIBUNG,
                        ),
                      }))
                    }
                    autoFocus
                  />
                  <div className={styles.charCounterRow}>
                    <span className={styles.hint}>
                      ca. 1.300 – 1.800 Zeichen inklusive Leerzeichen
                    </span>
                    <span
                      className={`${styles.charCounter} ${
                        value.length >= MAX_BESCHREIBUNG
                          ? styles.charCounterMax
                          : ""
                      }`}
                    >
                      {value.length} / {MAX_BESCHREIBUNG}
                    </span>
                  </div>
                </div>
              );
            },
          })}

          {renderFieldRow({
            field: "Link_URL",
            label: "Website",
            value: pinData.Link_URL ? (
              <a
                href={pinData.Link_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.viewLink}
              >
                {pinData.Link_URL}
              </a>
            ) : null,
            renderEdit: () => (
              // Link_Text ustawia serwer na stale ("Website") — partner podaje
              // wylacznie adres.
              <input
                type="url"
                aria-label="Website"
                className={styles.input}
                placeholder="https://…"
                value={(editValues.Link_URL as string) ?? ""}
                onChange={(e) =>
                  setEditValues((p) => ({ ...p, Link_URL: e.target.value }))
                }
                autoFocus
              />
            ),
          })}

          {renderFieldRow({
            field: "Titelbild",
            label: "Titelbild",
            value: pinData.Titelbild ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assetUrl(pinData.Titelbild!)}
                alt="Titelbild"
                className={styles.titelbildImg}
              />
            ) : null,
            renderEdit: () => {
              const previewUrl = editValues.Titelbild
                ? typeof editValues._titelbildPreview === "string"
                  ? editValues._titelbildPreview
                  : assetUrl(editValues.Titelbild as string)
                : pinData.Titelbild
                  ? assetUrl(pinData.Titelbild)
                  : null;
              return (
                <div className={styles.fieldGroup}>
                  {previewUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt=""
                      className={styles.titelbildImg}
                    />
                  )}
                  <input
                    ref={titelbildRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label="Neues Titelbild hochladen"
                    className={styles.hiddenInput}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setTitelbildUploading(true);
                      try {
                        const id = await uploadToDirectus(file);
                        setEditValues((p) => ({
                          ...p,
                          Titelbild: id,
                          _titelbildPreview: URL.createObjectURL(file),
                        }));
                      } catch {
                        setTitelbildError("Fehler beim Hochladen.");
                      } finally {
                        setTitelbildUploading(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className={styles.uploadButton}
                    onClick={() => titelbildRef.current?.click()}
                    disabled={titelbildUploading}
                  >
                    {titelbildUploading
                      ? "Wird hochgeladen…"
                      : "Neues Bild hochladen"}
                  </button>
                  {titelbildError && (
                    <p className={styles.uploadError}>{titelbildError}</p>
                  )}
                </div>
              );
            },
          })}

          {/* Galerie — premium, zawsze widoczna w view, edycja inline */}
          {isPremium && (
            <div className={styles.viewField}>
              <div className={styles.viewFieldHeader}>
                <span className={styles.viewFieldLabel}>Bildergalerie</span>
              </div>
              <div className={styles.galerieGrid}>
                {galerieItems.map((item) => (
                  <div key={item.junctionId} className={styles.galerieItem}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.preview}
                      alt=""
                      className={styles.galerieImg}
                    />
                    <button
                      type="button"
                      className={styles.removeButtonSmall}
                      onClick={() => removeGalerieItem(item)}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {galerieItems.length < 6 && (
                  <button
                    type="button"
                    className={styles.galerieAddBtn}
                    onClick={() => galerieRef.current?.click()}
                    disabled={galerieUploading}
                  >
                    {galerieUploading ? "…" : "+"}
                  </button>
                )}
              </div>
              {galerieError && (
                <p className={styles.uploadError}>{galerieError}</p>
              )}
              <input
                ref={galerieRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                aria-label="Galeriebilder hochladen"
                className={styles.hiddenInput}
                onChange={handleGalerieEditUpload}
              />
            </div>
          )}

          {/* Audio */}
          <div className={styles.viewField}>
            <div className={styles.viewFieldHeader}>
              <span className={styles.viewFieldLabel}>Audiodatei</span>
              {isPremium && !editingFields.has("Audio") && (
                <button
                  type="button"
                  className={styles.editFieldBtn}
                  onClick={() => startEdit("Audio", pinData.Audio)}
                >
                  Bearbeiten
                </button>
              )}
            </div>
            {editingFields.has("Audio") ? (
              <div className={styles.viewFieldEdit}>
                {typeof editValues.Audio === "string" && (
                  <audio
                    controls
                    src={
                      typeof editValues._audioPreview === "string"
                        ? editValues._audioPreview
                        : assetUrl(editValues.Audio as string)
                    }
                    className={styles.audioPlayer}
                  />
                )}
                <input
                  ref={audioRef}
                  type="file"
                  accept="audio/mpeg,audio/mp4,audio/wav,audio/x-m4a"
                  aria-label="Neue Audiodatei hochladen"
                  className={styles.hiddenInput}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setAudioUploading(true);
                    try {
                      const id = await uploadToDirectus(file);
                      setEditValues((p) => ({
                        ...p,
                        Audio: id,
                        _audioPreview: URL.createObjectURL(file),
                      }));
                    } catch {
                      setAudioError("Fehler beim Hochladen.");
                    } finally {
                      setAudioUploading(false);
                    }
                  }}
                />
                <button
                  type="button"
                  className={styles.uploadButton}
                  onClick={() => audioRef.current?.click()}
                  disabled={audioUploading}
                >
                  {audioUploading
                    ? "Wird hochgeladen…"
                    : "Neue Audiodatei hochladen"}
                </button>
                {audioError && (
                  <p className={styles.uploadError}>{audioError}</p>
                )}
                <div className={styles.viewFieldActions}>
                  <button
                    type="button"
                    className={styles.saveFieldBtn}
                    disabled={savingFields.has("Audio") || audioUploading}
                    onClick={() => saveField("Audio", editValues.Audio)}
                  >
                    {savingFields.has("Audio") ? "Speichern…" : "Speichern"}
                  </button>
                  <button
                    type="button"
                    className={styles.cancelFieldBtn}
                    onClick={() => cancelEdit("Audio")}
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.viewFieldValue}>
                {fieldSaveSuccess.Audio && (
                  <span className={styles.savedBadge}>✓ Gespeichert</span>
                )}
                {pinData.Audio ? (
                  <audio
                    controls
                    src={assetUrl(pinData.Audio!)}
                    className={styles.audioPlayer}
                  />
                ) : (
                  <span className={styles.viewFieldEmpty}>—</span>
                )}
              </div>
            )}
          </div>

          {/* Kategorien */}
          <div className={styles.viewField}>
            <div className={styles.viewFieldHeader}>
              <span className={styles.viewFieldLabel}>Kategorien</span>
              {isPremium && !editingFields.has("Kategorie") && (
                <button
                  type="button"
                  className={styles.editFieldBtn}
                  onClick={() => {
                    startEdit("Kategorie", kategorienIds);
                    setEditValues((p) => ({ ...p, Kategorie: kategorienIds }));
                  }}
                >
                  Bearbeiten
                </button>
              )}
            </div>
            {editingFields.has("Kategorie") ? (
              <div className={styles.viewFieldEdit}>
                <div className={styles.checkboxGroup}>
                  {kategorienOptions.map((kat) => {
                    const selected =
                      (editValues.Kategorie as number[]) ?? kategorienIds;
                    return (
                      <label key={kat.id} className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={selected.includes(kat.id)}
                          onChange={() =>
                            setEditValues((p) => ({
                              ...p,
                              Kategorie: toggleMulti(selected, kat.id),
                            }))
                          }
                        />
                        {kat.name}
                      </label>
                    );
                  })}
                </div>
                <div className={styles.viewFieldActions}>
                  <button
                    type="button"
                    className={styles.saveFieldBtn}
                    disabled={savingFields.has("Kategorie")}
                    onClick={() => saveField("Kategorie", editValues.Kategorie)}
                  >
                    {savingFields.has("Kategorie") ? "Speichern…" : "Speichern"}
                  </button>
                  <button
                    type="button"
                    className={styles.cancelFieldBtn}
                    onClick={() => cancelEdit("Kategorie")}
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.viewFieldValue}>
                {fieldSaveSuccess.Kategorie && (
                  <span className={styles.savedBadge}>✓ Gespeichert</span>
                )}
                {kategorienIds.length > 0 ? (
                  kategorienIds
                    .map(
                      (id) => kategorienOptions.find((k) => k.id === id)?.name,
                    )
                    .filter(Boolean)
                    .join(", ")
                ) : (
                  <span className={styles.viewFieldEmpty}>—</span>
                )}
              </div>
            )}
          </div>

          {/* Zertifizierungen */}
          {(() => {
            const zertIds = (pinData.Zertifizierungen ?? []).map(
              (z) => z.Zertifizierungen_id,
            );
            return (
              <div className={styles.viewField}>
                <div className={styles.viewFieldHeader}>
                  <span className={styles.viewFieldLabel}>
                    Zertifizierungen &amp; Labels
                  </span>
                  {isPremium && !editingFields.has("Zertifizierungen") && (
                    <button
                      type="button"
                      className={styles.editFieldBtn}
                      onClick={() => {
                        startEdit("Zertifizierungen", zertIds);
                        setEditValues((p) => ({
                          ...p,
                          Zertifizierungen: zertIds,
                        }));
                      }}
                    >
                      Bearbeiten
                    </button>
                  )}
                </div>
                {editingFields.has("Zertifizierungen") ? (
                  <div className={styles.viewFieldEdit}>
                    <div className={styles.checkboxGroup}>
                      {zertOptions.map((zert) => {
                        const selected =
                          (editValues.Zertifizierungen as string[]) ?? zertIds;
                        return (
                          <label key={zert.id} className={styles.checkboxLabel}>
                            <input
                              type="checkbox"
                              className={styles.checkbox}
                              checked={selected.includes(zert.id)}
                              onChange={() =>
                                setEditValues((p) => ({
                                  ...p,
                                  Zertifizierungen: toggleMulti(
                                    selected,
                                    zert.id,
                                  ),
                                }))
                              }
                            />
                            {zert.name}
                          </label>
                        );
                      })}
                    </div>
                    <div className={styles.viewFieldActions}>
                      <button
                        type="button"
                        className={styles.saveFieldBtn}
                        disabled={savingFields.has("Zertifizierungen")}
                        onClick={() =>
                          saveField(
                            "Zertifizierungen",
                            editValues.Zertifizierungen,
                          )
                        }
                      >
                        {savingFields.has("Zertifizierungen")
                          ? "Speichern…"
                          : "Speichern"}
                      </button>
                      <button
                        type="button"
                        className={styles.cancelFieldBtn}
                        onClick={() => cancelEdit("Zertifizierungen")}
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.viewFieldValue}>
                    {fieldSaveSuccess.Zertifizierungen && (
                      <span className={styles.savedBadge}>✓ Gespeichert</span>
                    )}
                    {zertIds.length > 0 ? (
                      zertIds
                        .map((id) => zertOptions.find((z) => z.id === id)?.name)
                        .filter(Boolean)
                        .join(", ")
                    ) : (
                      <span className={styles.viewFieldEmpty}>—</span>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  // ==============================
  // TRYB NOWY FORMULARZ
  // ==============================
  return (
    <div className={styles.wrapper}>
      {!isPremium && (
        <div className={styles.introBlock}>
          <p className={styles.introText}>
            Hier kannst du <strong>einmalig deinen Audiopin einreichen</strong>.
            Die Eingabefelder sind begrenzt und der PIN kann nach der
            Einreichung nicht mehr bearbeitet werden.
          </p>
          <p className={styles.introText}>
            Nach Prüfung und Freigabe wird dein PIN auf der Karte
            veröffentlicht.
          </p>
          <p className={styles.introText}>
            <strong>Mehr Möglichkeiten?</strong> Mit dem{" "}
            <span className={styles.premiumBadge}>Partner PIN</span>&nbsp;kannst
            du deinen PIN jederzeit bearbeiten und zusätzliche Infos wie Link
            zur Website, Telefonnummer mit Anruffunktion, mehrere
            Zertifizierungen &amp; Labels sowie bis zu 6 Bilder hinterlegen.
            Damit unterstützt du außerdem die Weiterentwicklung des Fairführers.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Grunddaten</legend>
          <div className={styles.field}>
            <label htmlFor="pin-name" className={styles.label}>
              Name des PINs
            </label>
            <input
              id="pin-name"
              type="text"
              className={`${styles.input} ${fieldErrors.name ? styles.inputError : ""}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {fieldErrors.name && (
              <span className={styles.fieldError}>{fieldErrors.name}</span>
            )}
          </div>
          <div className={styles.field}>
            <label htmlFor="pin-geo" className={styles.label}>
              Adresse suchen
            </label>
            <div className={styles.geoWrapper}>
              <input
                id="pin-geo"
                type="text"
                className={`${styles.input} ${fieldErrors.adresse || fieldErrors.stadt ? styles.inputError : ""}`}
                value={geoQuery}
                onChange={(e) => handleGeoQueryChange(e.target.value)}
                onBlur={() => setTimeout(() => setGeoSuggestionsNew([]), 150)}
                placeholder="Straße, Stadt…"
                autoComplete="off"
              />
              {geoLoadingNew && (
                <span className={styles.geoLoading}>Suche…</span>
              )}
              {geoSuggestionsNew.length > 0 && (
                <ul className={styles.geoDropdown}>
                  {geoSuggestionsNew.map((s) => (
                    <li
                      key={s.place_name}
                      className={styles.geoDropdownItem}
                      onMouseDown={() => selectGeoSuggestion(s)}
                    >
                      {s.place_name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {!coordinates && (
              <span className={styles.geoHint}>
                Bitte wählen Sie eine Adresse aus der Vorschlagsliste aus.
              </span>
            )}
            {(fieldErrors.adresse || fieldErrors.stadt) && (
              <span className={styles.fieldError}>
                Bitte wählen Sie eine Adresse aus der Vorschlagsliste.
              </span>
            )}
          </div>
          {coordinates && (
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label htmlFor="pin-adresse-ro" className={styles.label}>
                  Straße &amp; PLZ
                </label>
                <input
                  id="pin-adresse-ro"
                  type="text"
                  className={`${styles.input} ${styles.inputReadonly}`}
                  value={adresse}
                  readOnly
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="pin-stadt-ro" className={styles.label}>
                  Stadt
                </label>
                <input
                  id="pin-stadt-ro"
                  type="text"
                  className={`${styles.input} ${styles.inputReadonly}`}
                  value={stadt}
                  readOnly
                />
              </div>
              {land && (
                <div className={styles.field}>
                  <label htmlFor="pin-land-ro" className={styles.label}>
                    Land
                  </label>
                  <input
                    id="pin-land-ro"
                    type="text"
                    className={`${styles.input} ${styles.inputReadonly}`}
                    value={land}
                    readOnly
                  />
                </div>
              )}
            </div>
          )}
          <div
            className={`${styles.field} ${!isPremium ? styles.premiumLocked : ""}`}
          >
            <label htmlFor="pin-telefon" className={styles.label}>
              Telefonnummer mit Anruffunktion&nbsp;
              {!isPremium && (
                <span className={styles.premiumBadge}>Partner PIN</span>
              )}
            </label>
            <input
              id="pin-telefon"
              type="tel"
              className={styles.input}
              value={telefon}
              onChange={(e) => setTelefon(e.target.value)}
              disabled={!isPremium}
              placeholder={!isPremium ? "Nur mit Partner PIN" : ""}
            />
          </div>
          <div
            className={`${styles.field} ${!isPremium ? styles.premiumLocked : ""}`}
          >
            <label htmlFor="pin-link-url" className={styles.label}>
              Website&nbsp;
              {!isPremium && (
                <span className={styles.premiumBadge}>Partner PIN</span>
              )}
            </label>
            <input
              id="pin-link-url"
              type="url"
              className={styles.input}
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder={!isPremium ? "Nur mit Partner PIN" : "https://…"}
              disabled={!isPremium}
            />
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>
            Beschreibung &amp; Audiodatei
          </legend>
          <p className={styles.hint}>
            Die Beschreibung ist der Text zu deinem Audiopin und sollte
            möglichst dem Inhalt deiner Audiodatei entsprechen. So können
            Besucher*innen die Geschichte während des Anhörens mitlesen oder sie
            alternativ lesen.
          </p>
          <div className={styles.field}>
            <label htmlFor="pin-beschreibung" className={styles.label}>
              Vollständige Beschreibung
            </label>
            <textarea
              id="pin-beschreibung"
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
            <label className={styles.label}>Audiodatei</label>
            {audioPreview ? (
              <div className={styles.audioPreview}>
                <audio
                  controls
                  src={audioPreview}
                  className={styles.audioPlayer}
                />
                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={() => {
                    setAudioId(null);
                    setAudioPreview(null);
                  }}
                >
                  Entfernen
                </button>
              </div>
            ) : (
              <div className={styles.buttonRow}>
                <button
                  type="button"
                  className={styles.uploadButton}
                  onClick={() => audioRef.current?.click()}
                  disabled={audioUploading}
                >
                  {audioUploading
                    ? "Wird hochgeladen…"
                    : "Audiodatei hochladen"}
                </button>
                <a
                  href={AUDIO_GUIDE_PDF}
                  download
                  className={styles.secondaryButton}
                >
                  <Download size={15} aria-hidden="true" />
                  Tipps für die Audiodatei
                </a>
              </div>
            )}
            <p className={styles.hint}>MP3, M4A, WAV — max. 50 MB</p>
            <p className={styles.hint}>
              Du bist dir unsicher, wie du deine Aufnahme gestaltest? In unserem
              Leitfaden (PDF) findest du Tipps zu Länge, Aufbau und Tonqualität
              deiner Audiodatei.
            </p>
            {audioError && <p className={styles.uploadError}>{audioError}</p>}
            <input
              ref={audioRef}
              type="file"
              accept="audio/mpeg,audio/mp4,audio/wav,audio/x-m4a"
              aria-label="Audiodatei hochladen"
              className={styles.hiddenInput}
              onChange={handleAudioUpload}
            />
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Kategorien</legend>
          {fieldErrors.kategorien && (
            <span className={styles.fieldError}>{fieldErrors.kategorien}</span>
          )}
          <div className={styles.checkboxGroup}>
            {kategorienOptions.map((kat) => (
              <label key={kat.id} className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={kategorien.includes(kat.id)}
                  onChange={() => setKategorien((p) => toggleMulti(p, kat.id))}
                />
                {kat.name}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>
            Zertifizierungen &amp; Labels
          </legend>
          <p className={styles.hint}>
            Bitte wähle eine Zertifizierung oder ein Label aus.
            <br />
            Mit dem <strong>Partner PIN</strong> kannst du mehrere hinterlegen.
          </p>
          <div className={styles.checkboxGroup}>
            {zertOptions.map((zert) => (
              <label key={zert.id} className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={zertifizierungen.includes(zert.id)}
                  onChange={() =>
                    setZertifizierungen((p) =>
                      // Bez Partner PIN mozna wybrac tylko jedna pozycje —
                      // kolejny klik zastepuje poprzedni wybor.
                      isPremium
                        ? toggleMulti(p, zert.id)
                        : p.includes(zert.id)
                          ? []
                          : [zert.id],
                    )
                  }
                />
                {zert.name}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Titelbild</legend>
          <p className={styles.hint}>
            Hauptbild des Pins (JPG, PNG, WebP — max. 5 MB).
          </p>
          {titelbildPreview && (
            <div className={styles.titelbildPreview}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={titelbildPreview}
                alt="Titelbild"
                className={styles.titelbildImg}
              />
              <button
                type="button"
                className={styles.removeButton}
                onClick={() => {
                  setTitelbildId(null);
                  setTitelbildPreview(null);
                }}
              >
                Entfernen
              </button>
            </div>
          )}
          {!titelbildPreview && (
            <button
              type="button"
              className={styles.uploadButton}
              onClick={() => titelbildRef.current?.click()}
              disabled={titelbildUploading}
            >
              {titelbildUploading ? "Wird hochgeladen…" : "Bild hochladen"}
            </button>
          )}
          {titelbildError && (
            <p className={styles.uploadError}>{titelbildError}</p>
          )}
          <input
            ref={titelbildRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Titelbild hochladen"
            className={styles.hiddenInput}
            onChange={handleTitelbildUpload}
          />
        </fieldset>

        <fieldset
          className={`${styles.fieldset} ${!isPremium ? styles.premiumLocked : ""}`}
        >
          <legend className={styles.legend}>
            Bildergalerie (max. 6)&nbsp;
            {!isPremium && (
              <span className={styles.premiumBadge}>Partner PIN</span>
            )}
          </legend>
          {!isPremium ? (
            <p className={styles.hint}>
              Die Bildergalerie ist nur mit dem Partner PIN verfügbar.
            </p>
          ) : (
            <>
              <p className={styles.hint}>
                Laden Sie bis zu 6 Bilder hoch (JPG, PNG, WebP).
              </p>
              {galeriePreviews.length > 0 && (
                <div className={styles.galerieGrid}>
                  {galeriePreviews.map((url, i) => (
                    <div key={url} className={styles.galerieItem}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className={styles.galerieImg} />
                      <button
                        type="button"
                        className={styles.removeButtonSmall}
                        onClick={() => {
                          setGalerieIds((p) => p.filter((_, j) => j !== i));
                          setGaleriePreviews((p) =>
                            p.filter((_, j) => j !== i),
                          );
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {galerieIds.length < 6 && (
                <button
                  type="button"
                  className={styles.uploadButton}
                  onClick={() => galerieRefNew.current?.click()}
                  disabled={galerieUploadingNew}
                >
                  {galerieUploadingNew
                    ? "Wird hochgeladen…"
                    : `Bilder hinzufügen (${galerieIds.length}/6)`}
                </button>
              )}
              {galerieErrorNew && (
                <p className={styles.uploadError}>{galerieErrorNew}</p>
              )}
              <input
                ref={galerieRefNew}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                aria-label="Galeriebilder hochladen"
                className={styles.hiddenInput}
                onChange={handleGalerieUploadNew}
              />
            </>
          )}
        </fieldset>

        <button
          type="submit"
          className={styles.submitButton}
          disabled={mode === "submitting"}
        >
          {mode === "submitting" ? "Wird eingereicht…" : "Audiopin einreichen"}
        </button>
        {submitError && <p className={styles.errorMessage}>{submitError}</p>}
      </form>
    </div>
  );
}
