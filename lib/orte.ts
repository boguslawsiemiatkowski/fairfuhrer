// lib/orte.ts
// Gemeinsame Datenschicht für alle Orte-Ansichten: Karte (/karte), Liste
// (/liste), Stadt-Hubs (/liste/[stadt]) und Detailseiten
// (/liste/[stadt]/[slug]).
//
// Die Transformation und die HTML-Bereinigung lagen vorher in
// app/karte/page.tsx. Sie liegen jetzt hier, damit alle Ansichten dieselben
// Daten in derselben Form sehen — eine Korrektur wirkt überall.
import "server-only";

import type {
  Category,
  DirectusCollectionResponse,
  DirectusKategorie,
  DirectusOrte,
  DirectusZertifizierungItem,
  Place,
  Zertifizierung,
} from "@/types";

const DIRECTUS_URL = (process.env.DIRECTUS_URL ?? "").replace(/\/+$/, "");

function requireBaseUrl(): string {
  if (!DIRECTUS_URL) {
    throw new Error("❌ Missing required environment variable: DIRECTUS_URL");
  }
  return DIRECTUS_URL;
}

// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    !isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  );
}

/**
 * Räumt HTML auf, das aus Word oder einem anderen WYSIWYG-Editor
 * eingefügt wurde. Erlaubt nur eine kleine Whitelist an Tags und entfernt
 * Word-Kommentare, style=/class=, &nbsp;-Ketten und leere Tags.
 */
export function sanitizeWordHtml(html: string): string {
  return html
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(?!\/?(?:p|br|strong|b|em|i|a|ul|ol|li)(?:\s|\/?>))[^>]+>/gi, "")
    .replace(/\s(?:style|class|id|lang|xml:\w+)="[^"]*"/gi, "")
    .replace(/&nbsp;(\s*&nbsp;)+/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/<(p|li)>\s*<\/\1>/gi, "")
    .replace(/(<br\s*\/?>\s*){3,}/gi, "<br><br>")
    .trim();
}

// Reine Hilfsfunktionen liegen in lib/orte-shared.ts (ohne `server-only`),
// damit die Filter auf /liste sie im Browser nutzen können. Hier
// re-exportiert, damit Server-Code nur eine Importstelle braucht.
export {
  cityToSegment,
  distanceInMeters,
  formatDistance,
  galleryUrls,
  htmlToPlainText,
  mainImageUrl,
  normalizeForSearch,
  pickDiscovery,
  truncateAtWord,
} from "./orte-shared";

import { cityToSegment } from "./orte-shared";

export function hasAudio(place: Place): boolean {
  return Boolean(place.Audio || place.Audio_Datei);
}

// ─── Transformation ─────────────────────────────────────────────────────────

export function transformDirectusOrteToPlace(ort: DirectusOrte): Place | null {
  try {
    if (
      !ort.location ||
      ort.location.type !== "Point" ||
      !ort.location.coordinates
    ) {
      console.error(`Fehlende Location für Ort ${ort.id}`);
      return null;
    }

    const [longitude, latitude] = ort.location.coordinates;
    if (!isValidCoordinate(latitude, longitude)) {
      console.error(
        `Ungültige Koordinaten für Ort ${ort.id}: lat=${latitude}, lng=${longitude}`,
      );
      return null;
    }

    if (!ort.Name || !ort.Adresse) {
      console.error(`Fehlende erforderliche Felder für Ort ${ort.id}`);
      return null;
    }

    return {
      id: ort.id,
      Name: ort.Name.trim(),
      slug: ort.slug?.trim() || undefined,
      Adresse: ort.Adresse.trim(),
      Stadt: ort.Stadt?.trim() || undefined,
      Land: ort.Land?.trim() || undefined,
      Telefon: ort.Telefon?.trim(),
      Vollbeschreibung: ort.Vollbeschreibung
        ? sanitizeWordHtml(ort.Vollbeschreibung)
        : undefined,
      location: ort.location,
      Kategorie:
        ort.Kategorie?.filter((k) => k.Kategorie_id && k.Kategorie_id !== null).map(
          (k): Category => ({
            id: k.Kategorie_id.id,
            name: k.Kategorie_id.Name.trim(),
            color: k.Kategorie_id.Farbe.trim(),
            description: k.Kategorie_id.Beschreibung?.trim(),
          }),
        ) ?? [],
      Hauptbild: ort.Hauptbild?.trim(),
      Titelbild:
        typeof ort.Titelbild === "string" ? ort.Titelbild.trim() : undefined,
      Audio_Datei: ort.Audio_Datei?.trim(),
      Audio: typeof ort.Audio === "string" ? ort.Audio.trim() : undefined,
      Link_URL: ort.Link_URL?.trim(),
      Link_Text: ort.Link_Text?.trim(),
      Galerie_Bilder: ort.Galerie_Bilder?.filter((img) => img.trim().length > 0),
      Galerie: Array.isArray(ort.Galerie)
        ? ort.Galerie
            .map((g) => (typeof g === "string" ? g : g?.directus_files_id))
            .filter((id): id is string => !!id)
        : undefined,
      Zertifizierungen: ort.Zertifizierungen
        ?.filter((z: DirectusZertifizierungItem) => z.Zertifizierungen_id !== null)
        .map(
          (z: DirectusZertifizierungItem): Zertifizierung => ({
            id: z.Zertifizierungen_id!.id,
            name: z.Zertifizierungen_id!.Name,
            imageUuid: z.Zertifizierungen_id!.Image ?? undefined,
            slug: z.Zertifizierungen_id!.slug ?? undefined,
          }),
        ),
    };
  } catch (error) {
    console.error(`Fehler bei der Transformation von Ort ${ort.id}:`, error);
    return null;
  }
}

// ─── Abrufe ─────────────────────────────────────────────────────────────────

const PUBLISHED_FILTER: Record<string, string> = {
  "filter[_or][0][Bearbeitungsstatus][_eq]": "veroeffentlicht",
  "filter[_or][1][Bearbeitungsstatus][_null]": "true",
};

const ORTE_BASE_FIELDS = [
  "id",
  "Name",
  "slug",
  "Adresse",
  "Stadt",
  "Land",
  "Telefon",
  "location",
  "Hauptbild",
  "Titelbild",
  "Audio_Datei",
  "Audio",
  "Link_URL",
  "Link_Text",
  "Galerie_Bilder",
  "Galerie.directus_files_id",
  "Kategorie.Kategorie_id.id",
  "Kategorie.Kategorie_id.Name",
  "Kategorie.Kategorie_id.Farbe",
  "Kategorie.Kategorie_id.Beschreibung",
  "Zertifizierungen.Zertifizierungen_id.id",
  "Zertifizierungen.Zertifizierungen_id.Name",
  "Zertifizierungen.Zertifizierungen_id.Image",
  "Zertifizierungen.Zertifizierungen_id.slug",
];

/** Seitengröße für die Beschreibungen — siehe Kommentar in fetchAllPlaces(). */
const BESCHREIBUNG_PAGE_SIZE = 200;

function buildOrteUrl(
  fields: string[],
  extra?: Record<string, string>,
): string {
  const url = new URL(`${requireBaseUrl()}/items/Orte`);
  url.searchParams.set("fields", fields.join(","));
  url.searchParams.set("limit", "-1");
  url.searchParams.set("sort", "Name");
  for (const [k, v] of Object.entries(PUBLISHED_FILTER)) {
    url.searchParams.set(k, v);
  }
  for (const [k, v] of Object.entries(extra ?? {})) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

async function fetchFromDirectus<T>(
  url: string,
  tag: string,
  revalidate = 86400,
): Promise<DirectusCollectionResponse<T>> {
  const token = process.env.DIRECTUS_TOKEN;
  const response = await fetch(url, {
    next: { revalidate, tags: [tag] },
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText} beim Abrufen von ${tag}`,
    );
  }

  const data = (await response.json()) as DirectusCollectionResponse<T>;
  if (data.errors?.length) {
    throw new Error(`Directus API Fehler bei ${tag}: ${data.errors[0].message}`);
  }
  return data;
}

/**
 * Alle veröffentlichten Orte.
 *
 * In zwei Teile geteilt, weil Next.js keine fetch-Antwort über 2 MB in den
 * Data Cache schreibt: `Vollbeschreibung` allein macht rund drei Viertel der
 * Nutzlast aus. Die Basisabfrage liegt bei ~470 KB, die Beschreibungen holen
 * wir in Seiten à 200 Einträgen (~600 KB). Ohne diese Teilung lief die Seite
 * bei jeder Revalidierung ohne Cache und holte alles neu aus Directus — fällt
 * der CMS dabei aus, gibt es nichts, woraus ausgeliefert werden könnte.
 */
export async function fetchAllPlaces(): Promise<Place[]> {
  const baseData = await fetchFromDirectus<DirectusOrte>(
    buildOrteUrl(ORTE_BASE_FIELDS),
    "orte",
  );

  const pages = Math.max(
    1,
    Math.ceil(baseData.data.length / BESCHREIBUNG_PAGE_SIZE),
  );

  const textPages = await Promise.all(
    Array.from({ length: pages }, (_, page) =>
      fetchFromDirectus<Pick<DirectusOrte, "id" | "Vollbeschreibung">>(
        buildOrteUrl(["id", "Vollbeschreibung"], {
          limit: String(BESCHREIBUNG_PAGE_SIZE),
          offset: String(page * BESCHREIBUNG_PAGE_SIZE),
        }),
        "orte",
      ),
    ),
  );

  const beschreibungById = new Map(
    textPages.flatMap((p) =>
      p.data.map((o) => [o.id, o.Vollbeschreibung] as const),
    ),
  );

  return baseData.data
    .map((o) =>
      transformDirectusOrteToPlace({
        ...o,
        Vollbeschreibung: beschreibungById.get(o.id) ?? undefined,
      }),
    )
    .filter((p): p is Place => p !== null);
}

/** Nur die Felder, die die Sitemap braucht. */
export interface SitemapPlace {
  slug?: string;
  Stadt?: string;
}

/**
 * Schlanke Abfrage für die Sitemap: nur slug und Stadt — rund 30 KB statt
 * 3 MB. Das Audio-Feld fiel mit `priority` aus der Sitemap weg; Google
 * wertet `priority` nicht aus.
 *
 * Eigener Cache-Tag "sitemap" statt "orte". Das ist der eigentliche Grund,
 * warum die Search Console „could not be read" meldete: die Sitemap hing am
 * Tag "orte", und der Directus-Flow invalidiert diesen bei JEDER Änderung an
 * einem Pin. Danach musste der nächste Abruf die Sitemap neu bauen und dafür
 * alle Orte samt Beschreibungen laden — auf einem schlafenden Render-Dienst
 * dauerte das 10 bis 35 Sekunden, und Google bricht vorher ab.
 *
 * Mit eigenem Tag bleibt die Sitemap im Cache, bis sie selbst erneuert wird
 * (revalidate = 86400). Dass ein neuer Pin erst nach einem Tag darin steht,
 * ist unerheblich — Google liest Sitemaps ohnehin nicht häufiger.
 */
export async function fetchPlacesForSitemap(): Promise<SitemapPlace[]> {
  const data = await fetchFromDirectus<Pick<DirectusOrte, "slug" | "Stadt">>(
    buildOrteUrl(["slug", "Stadt"]),
    "sitemap",
  );

  return data.data.map((o) => ({
    slug: o.slug?.trim() || undefined,
    Stadt: o.Stadt?.trim() || undefined,
  }));
}

export async function fetchCategories(): Promise<Category[]> {
  const url = new URL(`${requireBaseUrl()}/items/Kategorie`);
  url.searchParams.set("fields", "id,Name,Farbe,Beschreibung,Reihenfolge");
  url.searchParams.set("limit", "-1");
  url.searchParams.set("sort", "Reihenfolge");

  const data = await fetchFromDirectus<DirectusKategorie>(
    url.toString(),
    "kategorien",
  );

  return data.data
    .map((kat) => ({
      id: kat.id,
      name: kat.Name.trim(),
      color: kat.Farbe.trim(),
      description: kat.Beschreibung?.trim(),
    }))
    .filter((cat) => cat.name.length > 0 && cat.color.length > 0);
}

// ─── Nachschlagen für die Routen ────────────────────────────────────────────

export interface CityGroup {
  /** URL-Segment, z. B. "lindau". */
  segment: string;
  /** Anzeigename, z. B. "Lindau". */
  name: string;
  places: Place[];
}

/**
 * Orte nach Stadt gruppiert, alphabetisch. Orte ohne `slug` sind enthalten —
 * sie erscheinen in Listen, bekommen aber keine eigene Seite (siehe
 * generateStaticParams der Detailroute).
 */
export function groupByCity(places: Place[]): CityGroup[] {
  const groups = new Map<string, CityGroup>();

  for (const place of places) {
    const segment = cityToSegment(place.Stadt);
    if (!segment) continue;

    const existing = groups.get(segment);
    if (existing) {
      existing.places.push(place);
    } else {
      groups.set(segment, {
        segment,
        name: place.Stadt?.trim() ?? segment,
        places: [place],
      });
    }
  }

  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));
}

/** Findet einen Ort über Stadt-Segment und slug. */
export function findPlaceBySlug(
  places: Place[],
  citySegment: string,
  slug: string,
): Place | null {
  return (
    places.find(
      (p) => p.slug === slug && cityToSegment(p.Stadt) === citySegment,
    ) ?? null
  );
}

/** Kanonischer Pfad eines Ortes, oder null, wenn ihm ein slug fehlt. */
export function placeHref(place: Place): string | null {
  const segment = cityToSegment(place.Stadt);
  if (!segment || !place.slug) return null;
  return `/liste/${segment}/${place.slug}`;
}
