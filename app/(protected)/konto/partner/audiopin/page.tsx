"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Layers,
  Lock,
  MapPin,
  Mic,
  Pencil,
  Phone,
  Plus,
  Sparkles,
  Trash2,
  Globe,
  FileText,
  Award,
  LayoutPanelLeft,
  Monitor,
} from "lucide-react";
import CategoryIcon, { categoryColorFor } from "@/components/CategoryIcon";
import ColumnAudioPlayer from "@/components/ColumnAudioPlayer";
import { useAuth } from "@/context/AuthContext";
import {
  cityToSegment,
  sanitizeExternalUrl,
  sanitizeWordHtml,
} from "@/lib/orte-shared";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { isPremiumActiveForDates } from "@/types/auth";
import {
  AUDIO_GUIDE_PDF,
  fetchMapboxGeoSuggestions,
  MAX_BESCHREIBUNG,
  parseMapboxSuggestion,
  uploadToDirectus,
  type GeocodingSuggestion,
} from "@/utils/pinFormHelpers";
import styles from "./audiopin.module.css";

interface KategorieOption {
  id: number;
  name: string;
  color?: string;
}

interface ZertOption {
  id: string;
  name: string;
  imageUuid?: string;
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
  slug?: string | null;
  Adresse: string;
  Stadt: string;
  Land: string | null;
  Telefon: string | null;
  Vollbeschreibung: string | null;
  Link_URL: string | null;
  Link_Text: string | null;
  Titelbild: string | null;
  Audio: string | null;
  Pin_Typ?: string | null;
  Bearbeitungsstatus?: string | null;
  location: { type: string; coordinates: [number, number] } | null;
  Galerie: { id: number; directus_files_id: string }[];
  Kategorie: { Kategorie_id: number }[];
  Zertifizierungen: { Zertifizierungen_id: string }[];
}

type StudioSection =
  | "name"
  | "adresse"
  | "kategorien"
  | "titelbild"
  | "audio"
  | "beschreibung"
  | "kontakt"
  | "galerie"
  | "zertifizierungen";

type PreviewViewMode = "split" | "panel" | "page";

// Proxy przez nasz API dla plików wymagających autoryzacji (galeria, titelbild, audio partnera)
function assetUrl(uuid: string) {
  return `/api/asset/${uuid}`;
}

export default function AudiopinPage() {
  const { user, isPro } = useAuth();
  const [dbPremiumUntil, setDbPremiumUntil] = useState<string | null>(null);
  const [premiumChecked, setPremiumChecked] = useState(false);

  // Ujednolicony status Premium: z kontekstu Auth (profiles + partner_profiles) lub świeżego odczytu
  const isPremium =
    isPro ||
    isPremiumActiveForDates(
      user?.profile?.premium_until,
      dbPremiumUntil ?? user?.partnerProfile?.premium_until,
    );

  // Opcje kategorii i certyfikatów z Directusa (/api/pin-optionen)
  const [kategorienOptions, setKategorienOptions] = useState<KategorieOption[]>(
    [],
  );
  const [zertOptions, setZertOptions] = useState<ZertOption[]>([]);

  // Tryby strony: loading | new_form (tworzenie nowego pina na żywo) | view (edycja istniejącego pina na żywo) | submitting
  type PageMode = "loading" | "new_form" | "view" | "submitting";
  const [mode, setMode] = useState<PageMode>("loading");
  const [pinId, setPinId] = useState<number | null>(null);
  const [pinData, setPinData] = useState<PinData | null>(null);
  const [pinLoading, setPinLoading] = useState(false);

  // Wybrany widok podglądu oraz aktualnie otwarta sekcja edytora w Studio
  const [previewMode, setPreviewMode] = useState<PreviewViewMode>("split");
  const [activeSection, setActiveSection] = useState<StudioSection | null>(
    "name",
  );

  // Stan zapisywania pojedynczych sekcji (w trybie istniejącego pina)
  const [savingSection, setSavingSection] = useState<StudioSection | null>(
    null,
  );
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  // Wartości robocze formularza / edytora (używane zarówno przy tworzeniu nowego pina, jak i edycji istniejącego)
  const [name, setName] = useState("");
  const [adresse, setAdresse] = useState("");
  const [stadt, setStadt] = useState("");
  const [land, setLand] = useState("");
  const [coordinates, setCoordinates] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [geoQuery, setGeoQuery] = useState("");
  const [geoSuggestions, setGeoSuggestions] = useState<GeocodingSuggestion[]>(
    [],
  );
  const [geoLoading, setGeoLoading] = useState(false);
  const geoDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [telefon, setTelefon] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [vollbeschreibung, setVollbeschreibung] = useState("");
  const [kategorien, setKategorien] = useState<number[]>([]);
  const [zertifizierungen, setZertifizierungen] = useState<string[]>([]);

  // Pliki: Titelbild, Audio, Galerie
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

  const [galerieItems, setGalerieItems] = useState<GalerieItem[]>([]);
  const [galerieUploading, setGalerieUploading] = useState(false);
  const [galerieError, setGalerieError] = useState<string | null>(null);
  const galerieRef = useRef<HTMLInputElement>(null);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const editorPanelRef = useRef<HTMLDivElement>(null);

  // 1. Załaduj opcje kategorii i certyfikatów z Directusa
  useEffect(() => {
    fetch("/api/pin-optionen")
      .then((r) => r.json())
      .then((data) => {
        setKategorienOptions(data.kategorien ?? []);
        setZertOptions(data.zertifizierungen ?? []);
      })
      .catch(() => {});
  }, []);

  // 2. Załaduj status premium i pin_id (z uwzględnieniem danych z AuthContext oraz Supabase)
  useEffect(() => {
    if (!user) return;
    const supabase = getSupabaseBrowserClient();
    supabase
      .from("partner_profiles")
      .select("premium_until, pin_id")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.premium_until) {
          setDbPremiumUntil(data.premium_until);
        }
        const effectivePinId =
          data?.pin_id ?? user.partnerProfile?.pin_id ?? null;
        if (effectivePinId) {
          setPinId(effectivePinId);
          setPinLoading(true);
          setMode("view");
          setActiveSection(null);
        } else {
          // Pre-fill z danych profilu partnera dla wygodniejszego startu
          if (user.partnerProfile?.company_name) {
            setName((prev) => prev || user.partnerProfile?.company_name || "");
          }
          if (user.partnerProfile?.phone_number) {
            setTelefon(
              (prev) => prev || user.partnerProfile?.phone_number || "",
            );
          }
          if (user.partnerProfile?.website_url) {
            setLinkUrl(
              (prev) => prev || user.partnerProfile?.website_url || "",
            );
          }
          setMode("new_form");
          setActiveSection("name");
        }
        setPremiumChecked(true);
      });
  }, [user]);

  // 3. Załaduj dane istniejącego pina z Directusa i zsynchronizuj ze stanem roboczym podglądu
  useEffect(() => {
    if (mode !== "view" || !pinId) return;
    fetch(`/api/audiopin/${pinId}`)
      .then(async (r) => {
        if (r.status === 404 || r.status === 403) {
          setPinId(null);
          setPinData(null);
          setGalerieItems([]);
          setMode("new_form");
          setActiveSection("name");
          return null;
        }
        if (!r.ok)
          throw new Error(`Pin konnte nicht geladen werden (${r.status})`);
        return (await r.json()) as PinData;
      })
      .then((data) => {
        if (!data) return;
        setPinData(data);
        setName(data.Name ?? "");
        setAdresse(data.Adresse ?? "");
        setStadt(data.Stadt ?? "");
        setLand(data.Land ?? "");
        setGeoQuery(
          [data.Adresse, data.Stadt, data.Land].filter(Boolean).join(", "),
        );
        if (
          data.location?.coordinates &&
          data.location.coordinates.length === 2
        ) {
          setCoordinates({
            lng: data.location.coordinates[0],
            lat: data.location.coordinates[1],
          });
        }
        setTelefon(data.Telefon ?? "");
        setLinkUrl(data.Link_URL ?? "");
        setVollbeschreibung(data.Vollbeschreibung ?? "");
        setKategorien((data.Kategorie ?? []).map((k) => k.Kategorie_id));
        setZertifizierungen(
          (data.Zertifizierungen ?? []).map((z) => z.Zertifizierungen_id),
        );
        setTitelbildId(data.Titelbild ?? null);
        setTitelbildPreview(data.Titelbild ? assetUrl(data.Titelbild) : null);
        setAudioId(data.Audio ?? null);
        setAudioPreview(data.Audio ? assetUrl(data.Audio) : null);
        setGalerieItems(
          (data.Galerie ?? []).map((g) => ({
            junctionId: g.id,
            fileId: g.directus_files_id,
            preview: assetUrl(g.directus_files_id),
          })),
        );
      })
      .catch(() => {})
      .finally(() => setPinLoading(false));
  }, [mode, pinId]);

  // Funkcja otwierająca wybraną sekcję edycji po kliknięciu elementu na podglądzie
  function openSectionEditor(section: StudioSection) {
    setSectionError(null);
    setActiveSection(section);
    // Przewiń delikatnie do paska edytora, jeśli znajduje się poza widokiem
    setTimeout(() => {
      editorPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 50);
  }

  function showSavedNotification(label: string) {
    setSavedBanner(`${label} wurde gespeichert und aktualisiert.`);
    setTimeout(() => {
      setSavedBanner((prev) =>
        prev === `${label} wurde gespeichert und aktualisiert.` ? null : prev,
      );
    }, 3500);
  }

  // ======== Geocoding (Mapbox) ========
  function handleGeoInput(value: string) {
    setGeoQuery(value);
    setAdresse(value);
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

  function handleSelectGeoSuggestion(suggestion: GeocodingSuggestion) {
    const parsed = parseMapboxSuggestion(suggestion);
    setCoordinates({ lat: parsed.lat, lng: parsed.lng });
    setAdresse(parsed.adresse);
    if (parsed.stadt) setStadt(parsed.stadt);
    if (parsed.land) setLand(parsed.land);
    setGeoQuery(parsed.placeName);
    setGeoSuggestions([]);
  }

  function toggleMulti<T>(list: T[], value: T): T[] {
    return list.includes(value)
      ? list.filter((v) => v !== value)
      : [...list, value];
  }

  // ======== Zapis pojedynczej sekcji (w trybie istniejącego pina dla Partner-Pin Premium) ========
  async function saveExistingPinSection(section: StudioSection) {
    if (!pinId || !isPremium) return;
    setSavingSection(section);
    setSectionError(null);

    try {
      let payload: Record<string, unknown> = {};
      let label = "Änderung";

      if (section === "name") {
        if (!name.trim()) {
          setSectionError("Der Name des Ortes darf nicht leer sein.");
          return;
        }
        payload = { Name: name.trim() };
        label = "Name";
      } else if (section === "adresse") {
        if (!adresse.trim() || !stadt.trim()) {
          setSectionError("Bitte geben Sie Straße und Stadt an.");
          return;
        }
        payload = {
          Adresse: adresse.trim(),
          Stadt: stadt.trim(),
          Land: land.trim() || null,
          ...(coordinates
            ? {
                location: {
                  type: "Point",
                  coordinates: [coordinates.lng, coordinates.lat],
                },
              }
            : {}),
        };
        label = "Adresse & Standort";
      } else if (section === "kategorien") {
        if (kategorien.length === 0) {
          setSectionError("Bitte wählen Sie mindestens eine Kategorie.");
          return;
        }
        payload = { Kategorie: kategorien };
        label = "Kategorien";
      } else if (section === "titelbild") {
        payload = { Titelbild: titelbildId };
        label = "Titelbild";
      } else if (section === "audio") {
        payload = { Audio: audioId };
        label = "Audiodatei";
      } else if (section === "beschreibung") {
        payload = { Vollbeschreibung: vollbeschreibung.trim() || null };
        label = "Beschreibung";
      } else if (section === "kontakt") {
        payload = {
          Telefon: telefon.trim() || null,
          Link_URL: linkUrl.trim() || null,
        };
        label = "Kontakt & Website";
      } else if (section === "zertifizierungen") {
        payload = { Zertifizierungen: zertifizierungen };
        label = "Zertifizierungen";
      }

      const res = await fetch(`/api/audiopin/${pinId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setSectionError(data.error ?? "Fehler beim Speichern.");
        return;
      }

      setPinData((prev) =>
        prev
          ? {
              ...prev,
              Name: name.trim(),
              Adresse: adresse.trim(),
              Stadt: stadt.trim(),
              Land: land.trim() || null,
              Telefon: telefon.trim() || null,
              Link_URL: linkUrl.trim() || null,
              Vollbeschreibung: vollbeschreibung.trim() || null,
              Titelbild: titelbildId,
              Audio: audioId,
              Pin_Typ: "premium",
              Bearbeitungsstatus: "veroeffentlicht",
              Kategorie: kategorien.map((id) => ({ Kategorie_id: id })),
              Zertifizierungen: zertifizierungen.map((id) => ({
                Zertifizierungen_id: id,
              })),
            }
          : prev,
      );
      showSavedNotification(label);
    } catch {
      setSectionError("Netzwerkfehler beim Speichern.");
    } finally {
      setSavingSection(null);
    }
  }

  // ======== Upload plików (Titelbild, Audio, Galerie) ========
  async function handleTitelbildChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setTitelbildError(null);
    setTitelbildUploading(true);
    try {
      const id = await uploadToDirectus(file);
      const localUrl = URL.createObjectURL(file);
      setTitelbildId(id);
      setTitelbildPreview(localUrl);

      // Jeśli edytujemy istniejący pin w trybie Premium, zapisz od razu w Directusie
      if (mode === "view" && pinId && isPremium) {
        const res = await fetch(`/api/audiopin/${pinId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ Titelbild: id }),
        });
        if (res.ok) {
          showSavedNotification("Titelbild");
        }
      }
    } catch {
      setTitelbildError(
        "Fehler beim Hochladen des Bildes (max. 5 MB, JPG/PNG/WebP).",
      );
    } finally {
      setTitelbildUploading(false);
      if (titelbildRef.current) titelbildRef.current.value = "";
    }
  }

  async function handleAudioChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioError(null);
    setAudioUploading(true);
    try {
      const id = await uploadToDirectus(file);
      const localUrl = URL.createObjectURL(file);
      setAudioId(id);
      setAudioPreview(localUrl);

      if (mode === "view" && pinId && isPremium) {
        const res = await fetch(`/api/audiopin/${pinId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ Audio: id }),
        });
        if (res.ok) {
          showSavedNotification("Audiodatei");
        }
      }
    } catch {
      setAudioError(
        "Fehler beim Hochladen der Audiodatei (max. 50 MB, MP3/M4A/WAV).",
      );
    } finally {
      setAudioUploading(false);
      if (audioRef.current) audioRef.current.value = "";
    }
  }

  async function handleGalerieUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = 6 - galerieItems.length;
    if (remaining <= 0) {
      setGalerieError("Maximal 6 Bilder in der Galerie erlaubt.");
      return;
    }
    setGalerieError(null);
    setGalerieUploading(true);
    try {
      const uploadedItems: GalerieItem[] = [];
      for (const file of files.slice(0, remaining)) {
        const fileId = await uploadToDirectus(file);
        uploadedItems.push({
          junctionId: `new-${fileId}`,
          fileId,
          preview: URL.createObjectURL(file),
          isNew: true,
        });
      }

      if (mode === "view" && pinId && isPremium) {
        const patchRes = await fetch(`/api/audiopin/${pinId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            Galerie_add: uploadedItems.map((i) => i.fileId),
          }),
        });
        if (patchRes.ok) {
          const getRes = await fetch(`/api/audiopin/${pinId}`);
          if (getRes.ok) {
            const fresh = (await getRes.json()) as PinData;
            setGalerieItems(
              (fresh.Galerie ?? []).map((g) => ({
                junctionId: g.id,
                fileId: g.directus_files_id,
                preview: assetUrl(g.directus_files_id),
              })),
            );
            showSavedNotification("Bildergalerie");
            return;
          }
        }
      }

      setGalerieItems((prev) => [...prev, ...uploadedItems]);
    } catch {
      setGalerieError("Fehler beim Hochladen der Galeriebilder.");
    } finally {
      setGalerieUploading(false);
      if (galerieRef.current) galerieRef.current.value = "";
    }
  }

  async function handleRemoveGalerieItem(item: GalerieItem) {
    if (mode === "new_form" || item.isNew) {
      setGalerieItems((prev) =>
        prev.filter((g) => g.junctionId !== item.junctionId),
      );
      return;
    }
    if (!pinId || !isPremium) return;
    const res = await fetch(`/api/audiopin/${pinId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Galerie_delete: [item.junctionId] }),
    });
    if (res.ok) {
      setGalerieItems((prev) =>
        prev.filter((g) => g.junctionId !== item.junctionId),
      );
      showSavedNotification("Bildergalerie");
    }
  }

  // ======== Utworzenie nowego pina (POST /api/audiopin) ========
  async function handleCreatePin(e: React.SyntheticEvent) {
    e.preventDefault();
    setSubmitError(null);
    const errors: Record<string, string> = {};
    if (!name.trim())
      errors.name = "Bitte geben Sie den Namen Ihres Ortes ein.";
    if (!adresse.trim() || !stadt.trim()) {
      errors.adresse =
        "Bitte wählen Sie eine vollständige Adresse (Straße & Stadt).";
    }
    if (kategorien.length === 0) {
      errors.kategorien = "Bitte wählen Sie mindestens eine Kategorie aus.";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      if (errors.name) setActiveSection("name");
      else if (errors.kategorien) setActiveSection("kategorien");
      else if (errors.adresse) setActiveSection("adresse");
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
          Galerie:
            isPremium && galerieItems.length > 0
              ? galerieItems.map((g) => g.fileId)
              : null,
          Audio: audioId ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Fehler beim Speichern des Pins.");
        setMode("new_form");
        return;
      }
      setPinId(data.id);
      setPinLoading(true);
      setMode("view");
      setActiveSection(null);
      showSavedNotification("Ihr Audiopin");
    } catch {
      setSubmitError("Es ist ein Verbindungsfehler aufgetreten.");
      setMode("new_form");
    }
  }

  if (!premiumChecked) return null;

  if (mode === "view" && pinLoading && !pinData) {
    return (
      <div className={styles.studioWrapper}>
        <div className={styles.loadingState}>
          <span className={styles.spinner} aria-hidden="true" />
          <p>Ihr Audiopin-Studio wird geladen…</p>
        </div>
      </div>
    );
  }

  // Dane wyliczone do żywego podglądu (Live Preview)
  const selectedCategories = kategorien
    .map((id) => kategorienOptions.find((k) => k.id === id))
    .filter((k): k is KategorieOption => Boolean(k));
  const primaryCategory = selectedCategories[0] ?? null;
  const themeColor = categoryColorFor(primaryCategory);

  const selectedZerts = zertifizierungen
    .map((id) => zertOptions.find((z) => z.id === id))
    .filter((z): z is ZertOption => Boolean(z));

  const safePreviewDescription = vollbeschreibung.trim()
    ? sanitizeWordHtml(vollbeschreibung)
    : null;
  const safePreviewLink = sanitizeExternalUrl(linkUrl);

  // Czy partner może aktualnie edytować pola?
  // - W trybie nowego pina ("new_form"): tak (pola podstawowe dla każdego, pola Premium dla Partner-Pin).
  // - W trybie istniejącego pina ("view"): pełna edycja na żywo z Partner-Pin (`isPremium === true`).
  const canEditBasic = mode === "new_form" || isPremium;
  const canEditPremium = isPremium;

  const publicUrl =
    pinData?.slug && stadt && cityToSegment(stadt)
      ? `/liste/${cityToSegment(stadt)}/${pinData.slug}`
      : null;

  // Lista klocków (Checkliste) na pasku szybkiego wyboru
  const studioModules: {
    id: StudioSection;
    label: string;
    filled: boolean;
    premiumOnly?: boolean;
  }[] = [
    { id: "name", label: "Name", filled: Boolean(name.trim()) },
    {
      id: "kategorien",
      label: "Kategorien",
      filled: kategorien.length > 0,
    },
    {
      id: "adresse",
      label: "Adresse & Lage",
      filled: Boolean(adresse.trim() && stadt.trim()),
    },
    {
      id: "titelbild",
      label: "Titelbild",
      filled: Boolean(titelbildPreview),
    },
    {
      id: "audio",
      label: "Audiodatei",
      filled: Boolean(audioPreview),
    },
    {
      id: "beschreibung",
      label: "Beschreibung",
      filled: Boolean(vollbeschreibung.trim()),
    },
    {
      id: "kontakt",
      label: "Telefon & Website",
      filled: Boolean(telefon.trim() || linkUrl.trim()),
      premiumOnly: true,
    },
    {
      id: "galerie",
      label: `Galerie (${galerieItems.length}/6)`,
      filled: galerieItems.length > 0,
      premiumOnly: true,
    },
    {
      id: "zertifizierungen",
      label: `Zertifikate (${zertifizierungen.length})`,
      filled: zertifizierungen.length > 0,
    },
  ];

  // ==============================
  // RENDEROWANIE PANELU EDYTORA DLA WYBRANEJ SEKCJI
  // ==============================
  function renderActiveSectionEditor() {
    if (!activeSection) return null;

    const isLockedByFreeView = mode === "view" && !isPremium;
    const isLockedByPremiumFeature =
      !isPremium &&
      (activeSection === "kontakt" || activeSection === "galerie");

    if (isLockedByFreeView || isLockedByPremiumFeature) {
      return (
        <div ref={editorPanelRef} className={styles.editorDrawer}>
          <div className={styles.editorDrawerHeader}>
            <div className={styles.editorTitleGroup}>
              <Lock size={18} className={styles.lockIcon} />
              <h4 className={styles.editorDrawerTitle}>
                {isLockedByFreeView
                  ? "Bearbeitung mit dem Partner-Pin freischalten"
                  : "Exklusives Partner-Pin Feature"}
              </h4>
            </div>
            <button
              type="button"
              className={styles.closeEditorBtn}
              onClick={() => setActiveSection(null)}
            >
              Schließen
            </button>
          </div>
          <p className={styles.upsellText}>
            Mit dem <strong>Partner-Pin</strong> können Sie Ihren Pin jederzeit
            in Echtzeit bearbeiten, sofort veröffentlichen sowie Website-Link,
            Telefonnummer mit Anruffunktion, bis zu 6 Galeriebilder und mehrere
            Zertifizierungen hinterlegen.
          </p>
          <div className={styles.editorActions}>
            <Link href="/konto/partner/premium" className={styles.upgradeBtn}>
              <Sparkles size={16} />
              Jetzt Partner-Pin aktivieren →
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div ref={editorPanelRef} className={styles.editorDrawer}>
        <div className={styles.editorDrawerHeader}>
          <div className={styles.editorTitleGroup}>
            <Pencil size={17} />
            <h4 className={styles.editorDrawerTitle}>
              {activeSection === "name" && "Name des Ortes bearbeiten"}
              {activeSection === "kategorien" &&
                "Kategorien & Farbschema wählen"}
              {activeSection === "adresse" && "Adresse & Karten-Standort"}
              {activeSection === "titelbild" && "Hauptbild (Titelbild)"}
              {activeSection === "audio" && "Audioguide / Audiodatei"}
              {activeSection === "beschreibung" && "Vollständige Beschreibung"}
              {activeSection === "kontakt" && "Telefonnummer & Website-Link"}
              {activeSection === "galerie" && "Bildergalerie (bis zu 6 Fotos)"}
              {activeSection === "zertifizierungen" &&
                "Zertifizierungen & Labels"}
            </h4>
          </div>
          <button
            type="button"
            className={styles.closeEditorBtn}
            onClick={() => setActiveSection(null)}
          >
            Fertig
          </button>
        </div>

        {/* Zawartość edytora zależna od wybranej sekcji */}
        <div className={styles.editorBody}>
          {activeSection === "name" && (
            <div className={styles.field}>
              <label htmlFor="studio-name" className={styles.label}>
                Wie heißt Ihr Ort / Unternehmen auf der Karte? *
              </label>
              <input
                id="studio-name"
                type="text"
                className={styles.input}
                placeholder="z. B. Bio-Hof Bodensee"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              {fieldErrors.name && (
                <span className={styles.fieldError}>{fieldErrors.name}</span>
              )}
            </div>
          )}

          {activeSection === "kategorien" && (
            <div className={styles.field}>
              <span className={styles.hint}>
                Die erste gewählte Kategorie bestimmt die Hintergrundfarbe Ihrer
                Detailseite und das Symbol auf der Karte.
              </span>
              <div className={styles.categoryGrid}>
                {kategorienOptions.map((kat) => {
                  const selected = kategorien.includes(kat.id);
                  const katColor = categoryColorFor(kat);
                  return (
                    <button
                      key={kat.id}
                      type="button"
                      onClick={() =>
                        setKategorien((prev) => toggleMulti(prev, kat.id))
                      }
                      className={`${styles.categoryChoiceBtn} ${
                        selected ? styles.categoryChoiceSelected : ""
                      }`}
                      style={
                        selected
                          ? ({
                              borderColor: katColor,
                              backgroundColor: `${katColor}15`,
                            } as React.CSSProperties)
                          : undefined
                      }
                    >
                      <CategoryIcon
                        categoryId={kat.id}
                        color={katColor}
                        size={28}
                      />
                      <span className={styles.categoryChoiceName}>
                        {kat.name}
                      </span>
                      {selected && (
                        <Check size={16} className={styles.categoryCheck} />
                      )}
                    </button>
                  );
                })}
              </div>
              {fieldErrors.kategorien && (
                <span className={styles.fieldError}>
                  {fieldErrors.kategorien}
                </span>
              )}
            </div>
          )}

          {activeSection === "adresse" && (
            <div className={styles.fieldGroup}>
              <div className={styles.field}>
                <label htmlFor="studio-geo" className={styles.label}>
                  Adresse suchen (automatische Koordinaten-Ermittlung) *
                </label>
                <div className={styles.geoWrapper}>
                  <input
                    id="studio-geo"
                    type="text"
                    className={styles.input}
                    value={geoQuery}
                    onChange={(e) => handleGeoInput(e.target.value)}
                    onBlur={() => setTimeout(() => setGeoSuggestions([]), 180)}
                    placeholder="Straße, Hausnummer, PLZ, Stadt eingeben…"
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
                          onMouseDown={() => handleSelectGeoSuggestion(s)}
                        >
                          <MapPin size={15} />
                          <span>{s.place_name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className={styles.fieldRowTriple}>
                <div className={styles.field}>
                  <label htmlFor="studio-strasse" className={styles.label}>
                    Straße &amp; PLZ *
                  </label>
                  <input
                    id="studio-strasse"
                    type="text"
                    className={styles.input}
                    value={adresse}
                    onChange={(e) => setAdresse(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="studio-stadt" className={styles.label}>
                    Stadt *
                  </label>
                  <input
                    id="studio-stadt"
                    type="text"
                    className={styles.input}
                    value={stadt}
                    onChange={(e) => setStadt(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="studio-land" className={styles.label}>
                    Land
                  </label>
                  <input
                    id="studio-land"
                    type="text"
                    className={styles.input}
                    value={land}
                    onChange={(e) => setLand(e.target.value)}
                    placeholder="z. B. Deutschland"
                  />
                </div>
              </div>
              {coordinates && (
                <p className={styles.coordHint}>
                  ✓ Karten-Koordinaten gesetzt ({coordinates.lat.toFixed(5)},{" "}
                  {coordinates.lng.toFixed(5)})
                </p>
              )}
              {fieldErrors.adresse && (
                <span className={styles.fieldError}>{fieldErrors.adresse}</span>
              )}
            </div>
          )}

          {activeSection === "titelbild" && (
            <div className={styles.fieldGroup}>
              <p className={styles.hint}>
                Das Titelbild erscheint ganz oben im Karten-Panel und als großes
                Hauptbild auf Ihrer Audiopin-Seite (JPG, PNG, WebP — max. 5 MB).
              </p>
              <div className={styles.buttonRow}>
                <button
                  type="button"
                  className={styles.uploadButton}
                  onClick={() => titelbildRef.current?.click()}
                  disabled={titelbildUploading}
                >
                  <ImageIcon size={16} />
                  {titelbildUploading
                    ? "Wird hochgeladen…"
                    : titelbildPreview
                      ? "Titelbild ersetzen"
                      : "Titelbild auswählen & hochladen"}
                </button>
                {titelbildPreview && (
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => {
                      setTitelbildId(null);
                      setTitelbildPreview(null);
                    }}
                  >
                    <Trash2 size={15} />
                    Bild entfernen
                  </button>
                )}
              </div>
              {titelbildError && (
                <p className={styles.uploadError}>{titelbildError}</p>
              )}
            </div>
          )}

          {activeSection === "audio" && (
            <div className={styles.fieldGroup}>
              <p className={styles.hint}>
                Laden Sie Ihren gesprochenen Audiobeitrag hoch (MP3, M4A, WAV —
                max. 50 MB). Der Player erscheint sowohl im Karten-Panel als
                auch in der linken Spalte Ihrer Detailseite.
              </p>
              <div className={styles.buttonRow}>
                <button
                  type="button"
                  className={styles.uploadButton}
                  onClick={() => audioRef.current?.click()}
                  disabled={audioUploading}
                >
                  <Mic size={16} />
                  {audioUploading
                    ? "Wird hochgeladen…"
                    : audioPreview
                      ? "Audiodatei ersetzen"
                      : "Audiodatei auswählen & hochladen"}
                </button>
                {audioPreview && (
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => {
                      setAudioId(null);
                      setAudioPreview(null);
                    }}
                  >
                    <Trash2 size={15} />
                    Audio entfernen
                  </button>
                )}
                <a
                  href={AUDIO_GUIDE_PDF}
                  download
                  className={styles.secondaryButton}
                >
                  <Download size={15} aria-hidden="true" />
                  Leitfaden &amp; Tipps (PDF)
                </a>
              </div>
              {audioError && <p className={styles.uploadError}>{audioError}</p>}
            </div>
          )}

          {activeSection === "beschreibung" && (
            <div className={styles.fieldGroup}>
              <p className={styles.hint}>
                Die Beschreibung begleitet Ihren Audiopin zum Mitlesen oder
                Nachlesen. Empfohlen: ca. 1.300 – 1.800 Zeichen (max.{" "}
                {MAX_BESCHREIBUNG}).
              </p>
              <textarea
                aria-label="Vollständige Beschreibung"
                className={styles.textarea}
                rows={8}
                maxLength={MAX_BESCHREIBUNG}
                placeholder="Erzählen Sie die Geschichte Ihres Ortes, was Besucher*innen erwartet und was Ihr Angebot besonders nachhaltig macht…"
                value={vollbeschreibung}
                onChange={(e) =>
                  setVollbeschreibung(e.target.value.slice(0, MAX_BESCHREIBUNG))
                }
                autoFocus
              />
              <div className={styles.charCounterRow}>
                <span className={styles.hint}>
                  Änderungen sind sofort unten in beiden Vorschauen sichtbar.
                </span>
                <span
                  className={`${styles.charCounter} ${
                    vollbeschreibung.length >= MAX_BESCHREIBUNG
                      ? styles.charCounterMax
                      : ""
                  }`}
                >
                  {vollbeschreibung.length} / {MAX_BESCHREIBUNG} Zeichen
                </span>
              </div>
            </div>
          )}

          {activeSection === "kontakt" && (
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label htmlFor="studio-tel" className={styles.label}>
                  Telefonnummer (mit direkter Anruffunktion)
                </label>
                <input
                  id="studio-tel"
                  type="tel"
                  className={styles.input}
                  placeholder="+49 7531 …"
                  value={telefon}
                  onChange={(e) => setTelefon(e.target.value)}
                  autoFocus
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="studio-url" className={styles.label}>
                  Website-URL (Button „Website besuchen")
                </label>
                <input
                  id="studio-url"
                  type="url"
                  className={styles.input}
                  placeholder="https://www.ihre-website.de"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                />
              </div>
            </div>
          )}

          {activeSection === "galerie" && (
            <div className={styles.fieldGroup}>
              <p className={styles.hint}>
                Präsentieren Sie Ihren Ort mit bis zu 6 zusätzlichen Fotos in
                der interaktiven Bildergalerie (JPG, PNG, WebP).
              </p>
              <div className={styles.galerieGrid}>
                {galerieItems.map((item) => (
                  <div key={item.junctionId} className={styles.galerieItem}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.preview}
                      alt="Galeriebild"
                      className={styles.galerieImg}
                    />
                    <button
                      type="button"
                      className={styles.removeButtonSmall}
                      onClick={() => handleRemoveGalerieItem(item)}
                      aria-label="Galeriebild entfernen"
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
                    <Plus size={22} />
                    <span>
                      {galerieUploading
                        ? "Lädt…"
                        : `Foto (${galerieItems.length}/6)`}
                    </span>
                  </button>
                )}
              </div>
              {galerieError && (
                <p className={styles.uploadError}>{galerieError}</p>
              )}
            </div>
          )}

          {activeSection === "zertifizierungen" && (
            <div className={styles.fieldGroup}>
              <p className={styles.hint}>
                {isPremium
                  ? "Als Partner-Pin können Sie beliebig viele zutreffende Zertifizierungen & Nachhaltigkeits-Labels auswählen."
                  : "Im kostenlosen Basis-Konto können Sie 1 Zertifizierung wählen. Mit dem Partner-Pin sind beliebig viele Labels möglich."}
              </p>
              <div className={styles.zertSelectGrid}>
                {zertOptions.map((zert) => {
                  const selected = zertifizierungen.includes(zert.id);
                  return (
                    <button
                      key={zert.id}
                      type="button"
                      onClick={() =>
                        setZertifizierungen((prev) =>
                          isPremium
                            ? toggleMulti(prev, zert.id)
                            : prev.includes(zert.id)
                              ? []
                              : [zert.id],
                        )
                      }
                      className={`${styles.zertSelectBtn} ${
                        selected ? styles.zertSelectBtnActive : ""
                      }`}
                    >
                      {zert.imageUuid && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={assetUrl(zert.imageUuid)}
                          alt=""
                          className={styles.zertSelectIcon}
                        />
                      )}
                      <span>{zert.name}</span>
                      {selected && <Check size={15} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {sectionError && <p className={styles.fieldError}>{sectionError}</p>}

          {/* W trybie edycji istniejącego pina pokazujemy przycisk bezpośredniego zapisu sekcji */}
          {mode === "view" &&
            isPremium &&
            activeSection !== "titelbild" &&
            activeSection !== "audio" &&
            activeSection !== "galerie" && (
              <div className={styles.editorActions}>
                <button
                  type="button"
                  className={styles.saveSectionBtn}
                  disabled={savingSection === activeSection}
                  onClick={() => saveExistingPinSection(activeSection)}
                >
                  <Check size={16} />
                  {savingSection === activeSection
                    ? "Wird gespeichert…"
                    : "Änderung jetzt speichern"}
                </button>
              </div>
            )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.studioWrapper}>
      {/* Ukryte inputy dla uploadu plików (dostępne z każdego miejsca w Studio) */}
      <input
        ref={titelbildRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Titelbild hochladen"
        className={styles.hiddenInput}
        onChange={handleTitelbildChange}
      />
      <input
        ref={audioRef}
        type="file"
        accept="audio/mpeg,audio/mp4,audio/wav,audio/x-m4a"
        aria-label="Audiodatei hochladen"
        className={styles.hiddenInput}
        onChange={handleAudioChange}
      />
      <input
        ref={galerieRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        aria-label="Galeriebilder hochladen"
        className={styles.hiddenInput}
        onChange={handleGalerieUpload}
      />

      {/* 1. PASEK NAGŁÓWKA STUDIO (Status konta, przełącznik widoków, publikacja) */}
      <div className={styles.studioTopBar}>
        <div className={styles.studioTopLeft}>
          <div className={styles.studioStatusRow}>
            {isPremium ? (
              <span className={styles.badgePartnerPin}>
                <Sparkles size={14} />
                Partner-Pin Studio (Premium aktiv)
              </span>
            ) : (
              <span className={styles.badgeFreePin}>
                Basis-Version (Kostenloser Audiopin)
              </span>
            )}

            {mode === "view" && pinData && (
              <span
                className={
                  pinData.Bearbeitungsstatus === "veroeffentlicht" || isPremium
                    ? styles.statusPublished
                    : styles.statusPending
                }
              >
                {pinData.Bearbeitungsstatus === "veroeffentlicht" || isPremium
                  ? "● Auf der Karte veröffentlicht"
                  : "◐ Wartet auf redaktionelle Freigabe"}
              </span>
            )}

            {publicUrl && (
              <Link
                href={publicUrl}
                target="_blank"
                className={styles.publicPageLink}
              >
                Live-Seite öffnen <ExternalLink size={13} />
              </Link>
            )}
          </div>

          <h2 className={styles.studioHeading}>
            {mode === "new_form"
              ? isPremium
                ? "Gestalten Sie Ihren Partner-Pin in der Live-Vorschau"
                : "Gestalten Sie Ihren Audiopin in der Live-Vorschau"
              : "Ihr Audiopin — Interaktive Live-Vorschau & Bearbeitung"}
          </h2>
          <p className={styles.studioSubheading}>
            Klicken Sie direkt auf ein beliebiges Element im{" "}
            <strong>Karten-Panel</strong> oder auf der{" "}
            <strong>Audiopin-Detailseite</strong>, um Ihre Inhalte einzufügen
            und sofort zu sehen, wie Besucher*innen Ihren Ort erleben.
          </p>
        </div>

        {/* Przełącznik widoku: Split vs Panel Mapy vs Strona szczegółowa */}
        <div
          className={styles.viewModeGroup}
          role="tablist"
          aria-label="Vorschau-Ansicht wählen"
        >
          <button
            type="button"
            role="tab"
            aria-selected={previewMode === "split"}
            className={`${styles.viewModeBtn} ${
              previewMode === "split" ? styles.viewModeBtnActive : ""
            }`}
            onClick={() => setPreviewMode("split")}
          >
            <Layers size={16} />
            <span>Beide Ansichten</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={previewMode === "panel"}
            className={`${styles.viewModeBtn} ${
              previewMode === "panel" ? styles.viewModeBtnActive : ""
            }`}
            onClick={() => setPreviewMode("panel")}
          >
            <LayoutPanelLeft size={16} />
            <span>Karten-Panel</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={previewMode === "page"}
            className={`${styles.viewModeBtn} ${
              previewMode === "page" ? styles.viewModeBtnActive : ""
            }`}
            onClick={() => setPreviewMode("page")}
          >
            <Monitor size={16} />
            <span>Audiopin-Seite</span>
          </button>
        </div>
      </div>

      {/* Baner dla konta darmowego zachęcający do odblokowania funkcji Partner-Pin */}
      {!isPremium && (
        <div className={styles.upsellBanner}>
          <div className={styles.upsellBannerText}>
            <strong>Mehr Sichtbarkeit mit dem Partner-Pin:</strong> Schalten Sie
            jederzeitige Live-Bearbeitung, sofortige Veröffentlichung ohne
            Wartezeit, bis zu 6 Galeriebilder, Website-Button,
            Telefon-Anrufknopf und mehrere Zertifizierungen frei.
          </div>
          <Link
            href="/konto/partner/premium"
            className={styles.upsellBannerCta}
          >
            Partner-Pin ansehen →
          </Link>
        </div>
      )}

      {/* Pasek szybkiego dostępu do poszczególnych klocków pina (Bausteine) */}
      <div className={styles.moduleBar} aria-label="Pin-Bausteine">
        {studioModules.map((mod) => {
          const isActive = activeSection === mod.id;
          const isLocked = mod.premiumOnly && !isPremium;
          return (
            <button
              key={mod.id}
              type="button"
              onClick={() => openSectionEditor(mod.id)}
              className={`${styles.moduleChip} ${
                isActive ? styles.moduleChipActive : ""
              } ${mod.filled ? styles.moduleChipFilled : ""}`}
            >
              {isLocked ? (
                <Lock size={13} className={styles.chipIconLock} />
              ) : mod.filled ? (
                <Check size={14} className={styles.chipIconCheck} />
              ) : (
                <Pencil size={13} className={styles.chipIconEdit} />
              )}
              <span>{mod.label}</span>
              {isLocked && <span className={styles.chipPartnerTag}>PRO</span>}
            </button>
          );
        })}
      </div>

      {/* Powiadomienie o zapisaniu zmian */}
      {savedBanner && (
        <div className={styles.savedNotification} role="status">
          <Check size={16} />
          <span>{savedBanner}</span>
        </div>
      )}

      {/* Aktywny panel edycji wybranego elementu */}
      {renderActiveSectionEditor()}

      {/* GŁÓWNY OBSZAR PODGLĄDU NA ŻYWO (Karten-Panel + Audiopin-Detailseite) */}
      <div
        className={`${styles.previewsGrid} ${
          previewMode === "panel"
            ? styles.previewsSinglePanel
            : previewMode === "page"
              ? styles.previewsSinglePage
              : ""
        }`}
      >
        {/* ============================================================
            WIDOK 1: KARTEN-PANEL (odpowiednik PlaceInfoPanel na /karte)
           ============================================================ */}
        {(previewMode === "split" || previewMode === "panel") && (
          <section
            className={styles.previewColumnPanel}
            aria-label="Vorschau Karten-Panel"
          >
            <div className={styles.previewFrameHeader}>
              <span className={styles.previewFrameDot} />
              <span className={styles.previewFrameTitle}>
                Vorschau 1: Seitenpanel auf der interaktiven Karte (/karte)
              </span>
            </div>

            <div className={styles.mockPanel}>
              {/* 1. Zdjęcie główne (Titelbild) + nakładany odtwarzacz Audio */}
              <div className={styles.mockPanelHeroWrap}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => openSectionEditor("titelbild")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openSectionEditor("titelbild");
                    }
                  }}
                  className={`${styles.editableZone} ${styles.mockPanelHero} ${
                    activeSection === "titelbild"
                      ? styles.editableZoneActive
                      : ""
                  }`}
                >
                  {titelbildPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={titelbildPreview}
                      alt={name || "Titelbild"}
                      className={styles.mockPanelHeroImg}
                    />
                  ) : (
                    <div className={styles.mockHeroPlaceholder}>
                      <ImageIcon size={34} />
                      <span>Klicken, um Titelbild hochzuladen</span>
                      <small>JPG, PNG oder WebP (max. 5 MB)</small>
                    </div>
                  )}
                  <span className={styles.zoneFloatingBadge}>
                    <Pencil size={12} /> Titelbild
                  </span>
                </div>

                {/* Nakładany pasek Audio na dolnej krawędzi zdjęcia */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => openSectionEditor("audio")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openSectionEditor("audio");
                    }
                  }}
                  className={`${styles.editableZone} ${styles.mockPanelAudioOverlay} ${
                    activeSection === "audio" ? styles.editableZoneActive : ""
                  }`}
                >
                  {audioPreview ? (
                    <audio
                      controls
                      src={audioPreview}
                      className={styles.mockPanelAudioPlayer}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className={styles.mockAudioPlaceholder}>
                      <Mic size={16} />
                      <span>+ Audiodatei hinzufügen (MP3/M4A/WAV)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Odznaki kategorii (Kategorien) */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => openSectionEditor("kategorien")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openSectionEditor("kategorien");
                  }
                }}
                className={`${styles.editableZone} ${styles.mockPanelCategories} ${
                  activeSection === "kategorien"
                    ? styles.editableZoneActive
                    : ""
                }`}
              >
                {selectedCategories.length > 0 ? (
                  selectedCategories.map((cat) => (
                    <span
                      key={cat.id}
                      className={styles.mockCategoryBadge}
                      style={{
                        backgroundColor: categoryColorFor(cat),
                      }}
                    >
                      {cat.name}
                    </span>
                  ))
                ) : (
                  <span className={styles.mockEmptyPill}>
                    + Kategorien auswählen *
                  </span>
                )}
                <span className={styles.zoneCornerHint}>
                  <Pencil size={11} /> Kategorien
                </span>
              </div>

              {/* 3. Nazwa miejsca + Adres + Telefon */}
              <div className={styles.mockPanelHeaderSection}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => openSectionEditor("name")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openSectionEditor("name");
                    }
                  }}
                  className={`${styles.editableZone} ${styles.mockNameZone} ${
                    activeSection === "name" ? styles.editableZoneActive : ""
                  }`}
                >
                  <h3 className={styles.mockPanelTitle}>
                    {name.trim() || "Name Ihres Ortes hier eingeben…"}
                  </h3>
                  <span className={styles.zoneCornerHint}>
                    <Pencil size={11} /> Name
                  </span>
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => openSectionEditor("adresse")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openSectionEditor("adresse");
                    }
                  }}
                  className={`${styles.editableZone} ${styles.mockAddressZone} ${
                    activeSection === "adresse" ? styles.editableZoneActive : ""
                  }`}
                >
                  <p className={styles.mockPanelAddress}>
                    {adresse.trim() || stadt.trim() ? (
                      <>
                        {adresse}
                        {stadt ? `, ${stadt}` : ""}
                        {land ? ` (${land})` : ""}
                      </>
                    ) : (
                      "📍 Straße, PLZ & Stadt hier auswählen…"
                    )}
                  </p>
                  <span className={styles.zoneCornerHint}>
                    <MapPin size={11} /> Adresse
                  </span>
                </div>

                {/* Telefon w panelu mapy */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => openSectionEditor("kontakt")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openSectionEditor("kontakt");
                    }
                  }}
                  className={`${styles.editableZone} ${styles.mockContactInline} ${
                    activeSection === "kontakt" ? styles.editableZoneActive : ""
                  }`}
                >
                  {telefon.trim() && isPremium ? (
                    <span className={styles.mockPanelPhone}>📞 {telefon}</span>
                  ) : (
                    <span className={styles.mockOptionalHint}>
                      <Phone size={13} />
                      {isPremium
                        ? "+ Telefonnummer mit Anruffunktion hinzufügen"
                        : "🔒 Telefon-Anrufbutton (Partner-Pin)"}
                    </span>
                  )}
                </div>
              </div>

              {/* 4. Pełny opis (Vollbeschreibung) */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => openSectionEditor("beschreibung")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openSectionEditor("beschreibung");
                  }
                }}
                className={`${styles.editableZone} ${styles.mockPanelSection} ${
                  activeSection === "beschreibung"
                    ? styles.editableZoneActive
                    : ""
                }`}
              >
                {safePreviewDescription ? (
                  <div
                    className={styles.mockPanelDescription}
                    dangerouslySetInnerHTML={{ __html: safePreviewDescription }}
                  />
                ) : (
                  <div className={styles.mockTextPlaceholder}>
                    <FileText size={20} />
                    <span>
                      Hier erscheint Ihre ausführliche Beschreibung zum Mitlesen
                      und Entdecken. Klicken Sie hier, um Ihren Text einzugeben.
                    </span>
                  </div>
                )}
                <span className={styles.zoneCornerHint}>
                  <Pencil size={11} /> Beschreibung
                </span>
              </div>

              {/* 5. Przycisk Website besuchen */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => openSectionEditor("kontakt")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openSectionEditor("kontakt");
                  }
                }}
                className={`${styles.editableZone} ${styles.mockPanelSection} ${
                  activeSection === "kontakt" ? styles.editableZoneActive : ""
                }`}
              >
                {safePreviewLink && isPremium ? (
                  <span className={styles.mockWebsiteButton}>
                    Website besuchen
                  </span>
                ) : (
                  <div className={styles.mockWebsitePlaceholder}>
                    <Globe size={16} />
                    <span>
                      {isPremium
                        ? "+ Website-Button („Website besuchen“) verlinken"
                        : "🔒 Direktlink zur eigenen Website (Partner-Pin)"}
                    </span>
                  </div>
                )}
              </div>

              {/* 6. Bildergalerie w panelu mapy */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => openSectionEditor("galerie")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openSectionEditor("galerie");
                  }
                }}
                className={`${styles.editableZone} ${styles.mockPanelSection} ${
                  activeSection === "galerie" ? styles.editableZoneActive : ""
                }`}
              >
                <h4 className={styles.mockPanelSubheading}>Bildergalerie</h4>
                {galerieItems.length > 0 && isPremium ? (
                  <div className={styles.mockPanelGalleryGrid}>
                    {galerieItems.map((g) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={g.junctionId}
                        src={g.preview}
                        alt=""
                        className={styles.mockPanelGalleryThumb}
                      />
                    ))}
                  </div>
                ) : (
                  <div className={styles.mockGalleryPlaceholder}>
                    <ImageIcon size={18} />
                    <span>
                      {isPremium
                        ? "+ Bis zu 6 Galeriebilder hinzufügen"
                        : "🔒 Bildergalerie mit bis zu 6 Fotos (Partner-Pin)"}
                    </span>
                  </div>
                )}
              </div>

              {/* 7. Zertifizierungen & Labels w panelu mapy */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => openSectionEditor("zertifizierungen")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openSectionEditor("zertifizierungen");
                  }
                }}
                className={`${styles.editableZone} ${styles.mockPanelSection} ${
                  activeSection === "zertifizierungen"
                    ? styles.editableZoneActive
                    : ""
                }`}
              >
                <h4 className={styles.mockPanelSubheading}>
                  Zertifizierungen &amp; Labels
                </h4>
                {selectedZerts.length > 0 ? (
                  <div className={styles.mockZertGrid}>
                    {selectedZerts.map((z) => (
                      <div key={z.id} className={styles.mockZertBadgeItem}>
                        {z.imageUuid ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={assetUrl(z.imageUuid)}
                            alt={z.name}
                            title={z.name}
                            className={styles.mockZertLogo}
                          />
                        ) : (
                          <span className={styles.mockZertName}>{z.name}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.mockGalleryPlaceholder}>
                    <Award size={18} />
                    <span>+ Zertifizierungen &amp; Siegel auswählen</span>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ============================================================
            WIDOK 2: AUDIOPIN-DETAILSEITE (odpowiednik /liste/[stadt]/[slug])
           ============================================================ */}
        {(previewMode === "split" || previewMode === "page") && (
          <section
            className={styles.previewColumnPage}
            aria-label="Vorschau Audiopin-Detailseite"
          >
            <div className={styles.previewFrameHeader}>
              <span className={styles.previewFrameDot} />
              <span className={styles.previewFrameTitle}>
                Vorschau 2: Eigene Audiopin-Detailseite (/liste/
                {cityToSegment(stadt) || "stadt"}/…)
              </span>
            </div>

            <div className={styles.mockDetailPage}>
              {/* Lewa kolumna w kolorze wybranej kategorii */}
              <aside
                className={styles.mockDetailSidebar}
                style={{ backgroundColor: themeColor }}
              >
                <div className={styles.mockDetailSidebarInner}>
                  {/* Kategoria i ikona */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => openSectionEditor("kategorien")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openSectionEditor("kategorien");
                      }
                    }}
                    className={`${styles.sidebarEditableZone} ${
                      activeSection === "kategorien"
                        ? styles.sidebarEditableZoneActive
                        : ""
                    }`}
                  >
                    <CategoryIcon
                      categoryId={primaryCategory?.id ?? null}
                      color="rgba(255,255,255,0.22)"
                      strokeColor="#fff"
                      size={32}
                    />
                    <span>{primaryCategory?.name ?? "Kategorie wählen"}</span>
                  </div>

                  {/* Tytuł na pasku bocznym */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => openSectionEditor("name")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openSectionEditor("name");
                      }
                    }}
                    className={`${styles.sidebarEditableZone} ${
                      activeSection === "name"
                        ? styles.sidebarEditableZoneActive
                        : ""
                    }`}
                  >
                    <h3 className={styles.mockDetailTitle}>
                      {name.trim() || "Name Ihres Ortes"}
                    </h3>
                  </div>

                  {/* Adres na pasku bocznym */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => openSectionEditor("adresse")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openSectionEditor("adresse");
                      }
                    }}
                    className={`${styles.sidebarEditableZone} ${
                      activeSection === "adresse"
                        ? styles.sidebarEditableZoneActive
                        : ""
                    }`}
                  >
                    <p className={styles.mockDetailAddress}>
                      {adresse.trim() || "Straße & Hausnummer"}
                      <br />
                      {stadt.trim() || "Stadt"}
                      {land.trim() ? `, ${land.trim()}` : ""}
                    </p>
                  </div>

                  {/* Telefon i Website na pasku bocznym */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => openSectionEditor("kontakt")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openSectionEditor("kontakt");
                      }
                    }}
                    className={`${styles.sidebarEditableZone} ${styles.mockSidebarContact} ${
                      activeSection === "kontakt"
                        ? styles.sidebarEditableZoneActive
                        : ""
                    }`}
                  >
                    {isPremium && (telefon.trim() || safePreviewLink) ? (
                      <>
                        {telefon.trim() && (
                          <span className={styles.mockSidebarLink}>
                            {telefon}
                          </span>
                        )}
                        {safePreviewLink && (
                          <span className={styles.mockSidebarLink}>
                            Website besuchen
                          </span>
                        )}
                      </>
                    ) : (
                      <span className={styles.mockSidebarHint}>
                        {isPremium
                          ? "+ Telefon & Website hinzufügen"
                          : "🔒 Telefon & Website (Partner-Pin)"}
                      </span>
                    )}
                  </div>

                  {/* Odtwarzacz ColumnAudioPlayer na pasku bocznym */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => openSectionEditor("audio")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openSectionEditor("audio");
                      }
                    }}
                    className={`${styles.sidebarEditableZone} ${styles.mockSidebarPlayerWrap} ${
                      activeSection === "audio"
                        ? styles.sidebarEditableZoneActive
                        : ""
                    }`}
                  >
                    {audioPreview ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <ColumnAudioPlayer
                          src={audioPreview}
                          title={name || "Audioguide"}
                        />
                      </div>
                    ) : (
                      <div className={styles.mockSidebarAudioEmpty}>
                        <Mic size={18} />
                        <span>Audioguide hier hochladen</span>
                      </div>
                    )}
                  </div>
                </div>
              </aside>

              {/* Prawa kolumna strony szczegółowej */}
              <div className={styles.mockDetailMain}>
                {/* Zdjęcie główne w charakterystycznej ręcznie rysowanej ramce */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => openSectionEditor("titelbild")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openSectionEditor("titelbild");
                    }
                  }}
                  className={`${styles.editableZone} ${styles.mockDetailHeroZone} ${
                    activeSection === "titelbild"
                      ? styles.editableZoneActive
                      : ""
                  }`}
                >
                  {titelbildPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={titelbildPreview}
                      alt={name || "Titelbild"}
                      className={styles.mockDetailHeroImg}
                    />
                  ) : (
                    <div className={styles.mockDetailHeroEmpty}>
                      <ImageIcon size={32} />
                      <span>Titelbild in Handzeichnungs-Rahmen</span>
                    </div>
                  )}
                  <span className={styles.zoneCornerHint}>
                    <Pencil size={11} /> Titelbild
                  </span>
                </div>

                {/* Pełny opis na stronie szczegółowej */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => openSectionEditor("beschreibung")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openSectionEditor("beschreibung");
                    }
                  }}
                  className={`${styles.editableZone} ${styles.mockDetailTextZone} ${
                    activeSection === "beschreibung"
                      ? styles.editableZoneActive
                      : ""
                  }`}
                >
                  {safePreviewDescription ? (
                    <div
                      className={styles.mockDetailDescription}
                      dangerouslySetInnerHTML={{
                        __html: safePreviewDescription,
                      }}
                    />
                  ) : (
                    <p className={styles.mockDetailNoText}>
                      Für diesen Ort liegt noch keine Beschreibung vor — klicken
                      Sie hier, um Ihren Beschreibungstext einzufügen.
                    </p>
                  )}
                  <span className={styles.zoneCornerHint}>
                    <Pencil size={11} /> Beschreibung
                  </span>
                </div>

                {/* Rząd certyfikatów pod tekstem */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => openSectionEditor("zertifizierungen")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openSectionEditor("zertifizierungen");
                    }
                  }}
                  className={`${styles.editableZone} ${styles.mockDetailZertZone} ${
                    activeSection === "zertifizierungen"
                      ? styles.editableZoneActive
                      : ""
                  }`}
                >
                  {selectedZerts.length > 0 ? (
                    <div className={styles.mockDetailZertRow}>
                      {selectedZerts.map((z) =>
                        z.imageUuid ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={z.id}
                            src={assetUrl(z.imageUuid)}
                            alt={z.name}
                            title={z.name}
                            className={styles.mockDetailZertBadge}
                          />
                        ) : (
                          <span
                            key={z.id}
                            className={styles.mockDetailZertPill}
                          >
                            {z.name}
                          </span>
                        ),
                      )}
                    </div>
                  ) : (
                    <div className={styles.mockGalleryPlaceholder}>
                      <Award size={16} />
                      <span>
                        + Zertifizierungen &amp; Labels unter dem Text anzeigen
                      </span>
                    </div>
                  )}
                </div>

                {/* Sekcja Bildergalerie na stronie szczegółowej */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => openSectionEditor("galerie")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openSectionEditor("galerie");
                    }
                  }}
                  className={`${styles.editableZone} ${styles.mockDetailGalleryZone} ${
                    activeSection === "galerie" ? styles.editableZoneActive : ""
                  }`}
                >
                  <h4 className={styles.mockDetailSectionTitle}>
                    Bildergalerie
                  </h4>
                  {galerieItems.length > 0 && isPremium ? (
                    <div className={styles.mockDetailGalleryGrid}>
                      {galerieItems.map((g) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={g.junctionId}
                          src={g.preview}
                          alt=""
                          className={styles.mockDetailGalleryImg}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className={styles.mockGalleryPlaceholder}>
                      <ImageIcon size={18} />
                      <span>
                        {isPremium
                          ? "+ Fotos zur Bildergalerie hinzufügen (bis zu 6 Bilder)"
                          : "🔒 Bildergalerie auf der Detailseite (Partner-Pin)"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Sekcja Lage (Mapa lokalizacji na dole strony szczegółowej) */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => openSectionEditor("adresse")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openSectionEditor("adresse");
                    }
                  }}
                  className={`${styles.editableZone} ${styles.mockDetailMapZone} ${
                    activeSection === "adresse" ? styles.editableZoneActive : ""
                  }`}
                >
                  <h4 className={styles.mockDetailSectionTitle}>Lage</h4>
                  <div className={styles.mockMapCard}>
                    <div
                      className={styles.mockMapPinCircle}
                      style={{ backgroundColor: themeColor }}
                    >
                      <MapPin size={20} color="#fff" />
                    </div>
                    <div className={styles.mockMapInfo}>
                      <strong>
                        {name.trim() || "Ihr Standort auf der Karte"}
                      </strong>
                      <span>
                        {adresse.trim() || stadt.trim()
                          ? `${adresse}${stadt ? `, ${stadt}` : ""}`
                          : "Klicken, um Adresse & Koordinaten festzulegen"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* DOLNY PASEK PUBLIKACJI (gdy partner tworzy nowy Pin w trybie new_form / submitting) */}
      {(mode === "new_form" || mode === "submitting") && (
        <div className={styles.publishFooter}>
          <div className={styles.publishFooterInfo}>
            <strong>Bereit zur Veröffentlichung?</strong>
            <span>
              {isPremium
                ? "Mit Ihrem Partner-Pin wird Ihr Ort sofort auf der Karte veröffentlicht und kann jederzeit weiter bearbeitet werden."
                : "Ihr kostenloser Pin wird nach dem Absenden von unserer Redaktion geprüft und anschließend freigeschaltet."}
            </span>
            {submitError && (
              <p className={styles.submitErrorText}>{submitError}</p>
            )}
          </div>
          <button
            type="button"
            className={styles.publishPrimaryBtn}
            disabled={mode === "submitting" || !canEditBasic}
            onClick={handleCreatePin}
          >
            {mode === "submitting"
              ? "Wird gespeichert…"
              : isPremium
                ? "★ Partner-Pin jetzt sofort veröffentlichen"
                : "Kostenlosen Pin zur Prüfung einreichen"}
          </button>
        </div>
      )}
    </div>
  );
}
