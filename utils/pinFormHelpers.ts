// utils/pinFormHelpers.ts
// Wspólne stałe i funkcje pomocnicze dla formularzy tworzenia/edycji pinów
// (zarówno w panelu Partnera, jak i w formularzu Redaktion dla Reisender).

/** Twardy limit długości opisu pina; w UI sugerujemy 1.300–1.800 znaków. */
export const MAX_BESCHREIBUNG = 2000;

/** Wytyczne do nagrań audio — plik statyczny w katalogu /public. */
export const AUDIO_GUIDE_PDF = "/tipps-fur-die-audiodatei.pdf";

export interface GeocodingSuggestion {
  place_name: string;
  center: [number, number];
  context?: { id: string; text: string }[];
  text: string;
  address?: string;
}

export interface ParsedGeocodingSuggestion {
  lat: number;
  lng: number;
  adresse: string;
  stadt?: string;
  land?: string;
  placeName: string;
}

/**
 * Przesyła plik (obraz lub audio) do Directusa przez nasz endpoint serwerowy `/api/directus-upload`.
 * W przypadku błędu walidacji (np. za duży plik lub zły format) rzuca wyjątek z niemieckim komunikatem z API.
 */
export async function uploadToDirectus(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/directus-upload", {
    method: "POST",
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Upload fehlgeschlagen.",
    );
  }

  return data.id as string;
}

/**
 * Odpytuje API Mapbox Geocoding v5 o podpowiedzi adresów i aktualizuje przekazany stan komponentu.
 */
export async function fetchMapboxGeoSuggestions(
  query: string,
  setSuggestions: (s: GeocodingSuggestion[]) => void,
  setLoading: (b: boolean) => void,
  types = "address,place,poi",
): Promise<void> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || query.trim().length < 3) {
    setSuggestions([]);
    return;
  }

  setLoading(true);
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      query.trim(),
    )}.json?access_token=${token}&language=de&types=${types}&limit=5`;
    const res = await fetch(url);
    const json = await res.json();
    setSuggestions(json.features ?? []);
  } catch {
    setSuggestions([]);
  } finally {
    setLoading(false);
  }
}

/**
 * Wyciąga ustrukturyzowane pola adresowe (ulica + kod pocztowy, miasto, kraj, współrzędne)
 * z wybranej podpowiedzi Mapbox Geocoding.
 */
export function parseMapboxSuggestion(
  suggestion: GeocodingSuggestion,
): ParsedGeocodingSuggestion {
  const [lng, lat] = suggestion.center;
  const plzContext = suggestion.context?.find((c) =>
    c.id.startsWith("postcode."),
  );
  const cityContext = suggestion.context?.find((c) =>
    c.id.startsWith("place."),
  );
  const countryContext = suggestion.context?.find((c) =>
    c.id.startsWith("country."),
  );
  const streetPart = suggestion.address
    ? `${suggestion.text} ${suggestion.address}`
    : suggestion.text;
  const adresse = plzContext
    ? `${streetPart}, ${plzContext.text}`
    : streetPart;

  return {
    lat,
    lng,
    adresse,
    stadt: cityContext?.text,
    land: countryContext?.text,
    placeName: suggestion.place_name,
  };
}

