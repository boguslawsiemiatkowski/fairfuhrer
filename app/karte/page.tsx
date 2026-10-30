// app/karte/page.tsx - Complete fixed version with description support
import type { Metadata } from "next";
import MapWithFilters from "../../components/MapWithFilters";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { ConditionalMapbox } from "../../components/ConditionalMapbox";
import MapRealtimeRefresh from "../../components/MapRealtimeRefresh";
import type {
  Place,
  Category,
  Zertifizierung,
  DirectusCollectionResponse,
  DirectusKategorie,
  DirectusOrte,
  DirectusZertifizierungItem,
} from "../../types";

// ISR revalidation - dane będą odświeżane co 24 godziny
// Miejsca turystyczne zmieniają się rzadko, dłuższy cache = lepsza wydajność
export const revalidate = 86400; // 24 hours

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Walidacja współrzędnych geograficznych
 */
function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    !isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  );
}

/**
 * Czyści HTML przeklejony z Worda (lub innego edytora WYSIWYG).
 * Zostawia tylko bezpieczne tagi z białej listy: p, br, strong, b, em, i, a.
 * Usuwa: span, div, style=, class=, komentarze <!--[if gte mso]-->, &nbsp; sekwencje, puste tagi.
 */
function sanitizeWordHtml(html: string): string {
  return (
    html
      // Usuń komentarze Word/IE (<!--[if gte mso 9]>...<![endif]-->)
      .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, "")
      // Usuń wszystkie komentarze HTML
      .replace(/<!--[\s\S]*?-->/g, "")
      // Usuń tagi spoza białej listy (zachowaj ich zawartość)
      .replace(
        /<(?!\/?(?:p|br|strong|b|em|i|a|ul|ol|li)(?:\s|\/?>))[^>]+>/gi,
        "",
      )
      // Usuń style= i class= z pozostałych tagów
      .replace(/\s(?:style|class|id|lang|xml:\w+)="[^"]*"/gi, "")
      // Normalizuj &nbsp; → spacja, usuń wielokrotne niełamliwe spacje
      .replace(/&nbsp;(\s*&nbsp;)+/gi, " ")
      .replace(/&nbsp;/gi, " ")
      // Usuń puste tagi (np. <p></p>, <p> </p>)
      .replace(/<(p|li)>\s*<\/\1>/gi, "")
      // Usuń wielokrotne puste linie
      .replace(/(<br\s*\/?>\s*){3,}/gi, "<br><br>")
      // Usuń białe znaki na początku i końcu
      .trim()
  );
}

/**
 * Transformacja Directus Orte do Place z walidacją - FIXED
 */
function transformDirectusOrteToPlace(ort: DirectusOrte): Place | null {
  try {
    if (!ort.location || ort.location.type !== "Point" || !ort.location.coordinates) {
      console.error(`Fehlende Location für Ort ${ort.id}`);
      return null;
    }

    const [longitude, latitude] = ort.location.coordinates;

    if (!isValidCoordinate(latitude, longitude)) {
      console.error(
        `Ungültige Koordinaten für Ort ${ort.id}: lat=${latitude}, lng=${longitude}`
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
      Adresse: ort.Adresse.trim(),
      Stadt: ort.Stadt?.trim() || undefined,
      Land: ort.Land?.trim() || undefined,
      Telefon: ort.Telefon?.trim(),
      Vollbeschreibung: ort.Vollbeschreibung
        ? sanitizeWordHtml(ort.Vollbeschreibung)
        : undefined,
      location: ort.location,
      // ✅ FIXED: Proper filtering and mapping
      Kategorie:
        ort.Kategorie?.filter((k) => {
          // Check if Kategorie_id exists and is not null
          return k.Kategorie_id && k.Kategorie_id !== null;
        }).map(
          (k): Category => ({
            // ✅ FIXED: Explicitly return Category type
            id: k.Kategorie_id.id,
            name: k.Kategorie_id.Name.trim(),
            color: k.Kategorie_id.Farbe.trim(),
            description: k.Kategorie_id.Beschreibung?.trim(),
          })
        ) ?? [],
      Hauptbild: ort.Hauptbild?.trim(),
      Titelbild: typeof ort.Titelbild === "string" ? ort.Titelbild.trim() : undefined,
      Audio_Datei: ort.Audio_Datei?.trim(),
      Audio: typeof ort.Audio === "string" ? ort.Audio.trim() : undefined,
      Link_URL: ort.Link_URL?.trim(),
      Link_Text: ort.Link_Text?.trim(),
      Galerie_Bilder: ort.Galerie_Bilder?.filter(
        (img) => img.trim().length > 0
      ),
      Galerie: Array.isArray(ort.Galerie)
        ? ort.Galerie.map((g) =>
            typeof g === "string" ? g : g?.directus_files_id
          ).filter((id): id is string => !!id)
        : undefined,
      Zertifizierungen: ort.Zertifizierungen
        ?.filter((z: DirectusZertifizierungItem) => z.Zertifizierungen_id !== null)
        .map((z: DirectusZertifizierungItem): Zertifizierung => ({
          id: z.Zertifizierungen_id!.id,
          name: z.Zertifizierungen_id!.Name,
          imageUuid: z.Zertifizierungen_id!.Image ?? undefined,
          slug: z.Zertifizierungen_id!.slug ?? undefined,
        })),
    };
  } catch (error) {
    console.error(`Fehler bei der Transformation von Ort ${ort.id}:`, error);
    return null;
  }
}

/**
 * Fetch data from Directus with error handling
 */
async function fetchFromDirectus<T>(
  url: string,
  entityName: string
): Promise<DirectusCollectionResponse<T>> {
  const directusToken = process.env.DIRECTUS_TOKEN;
  try {
    const response = await fetch(url, {
      next: {
        revalidate: 86400, // 24 hours - match page-level revalidation
        tags: [entityName.toLowerCase()],
      },
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(directusToken ? { Authorization: `Bearer ${directusToken}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText} beim Abrufen von ${entityName}`
      );
    }

    const data = (await response.json()) as DirectusCollectionResponse<T>;

    if (data.errors?.length) {
      throw new Error(
        `Directus API Fehler bei ${entityName}: ${data.errors[0].message}`
      );
    }

    return data;
  } catch (error) {
    console.error(`Fehler beim Abrufen von ${entityName}:`, error);
    throw error;
  }
}

// ========================================
// MAIN PAGE COMPONENT
// ========================================

export default async function KartePage() {
  const rawUrl = process.env.DIRECTUS_URL;
  if (!rawUrl) {
    throw new Error(
      "DIRECTUS_URL Umgebungsvariable ist nicht in .env.local konfiguriert"
    );
  }

  const baseUrl = rawUrl.replace(/\/+$/, "");

  // Błędy pobierania danych celowo nie są tu łapane — obsługuje je
  // app/karte/error.tsx. Dzięki temu ISR przy nieudanej rewalidacji dalej
  // serwuje ostatnią poprawną wersję strony zamiast zapisywać w cache
  // strony błędu na 24 godziny.

  // ========================================
  // FETCH ORTE (PLACES) - Updated with Beschreibung
  // ========================================

  // In ZWEI Abfragen geteilt, weil Next.js keine fetch-Antwort über 2 MB in den
  // Data Cache schreibt ("items over 2MB can not be cached"). Zusammen waren es
  // 3,06 MB, davon allein 1,72 MB (77 %) `Vollbeschreibung` — die Seite lief
  // also bei jeder Revalidierung ohne Cache und holte alles neu aus Directus.
  // Fällt der CMS dabei aus, gibt es nichts, woraus ausgeliefert werden könnte.
  //
  // Beide Teilabfragen liegen jetzt deutlich unter dem Limit (~470 KB bzw.
  // ~1,8 MB) und werden einzeln gecacht. Die Seite erhält danach dieselben
  // Daten wie vorher — es wird kein Feld weggelassen.
  const orteBaseFields = [
    "id",
    "Name",
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

  function buildOrteUrl(
    fields: string[],
    paging?: { limit: string; offset: string }
  ): string {
    const url = new URL(`${baseUrl}/items/Orte`);
    url.searchParams.set("fields", fields.join(","));
    url.searchParams.set("limit", paging?.limit ?? "-1");
    if (paging) url.searchParams.set("offset", paging.offset);
    url.searchParams.set("sort", "Name");
    url.searchParams.set("filter[_or][0][Bearbeitungsstatus][_eq]", "veroeffentlicht");
    url.searchParams.set("filter[_or][1][Bearbeitungsstatus][_null]", "true");
    return url.toString();
  }

  // Die Basisabfrage zuerst, weil ihre Länge sagt, wie viele Beschreibungs-
  // Seiten nötig sind — so wächst das Paging mit dem Datenbestand mit, ohne
  // eine fest verdrahtete Anzahl.
  const orteBaseData = await fetchFromDirectus<DirectusOrte>(
    buildOrteUrl(orteBaseFields),
    "Orte"
  );

  // Die Beschreibungen allein sind ~2,4 MB und sprengen das 2-MB-Limit
  // weiterhin, daher in Seiten à 200 Einträgen (~800 KB pro Seite). `sort=Name`
  // ist in allen Abfragen gleich, also ist die Reihenfolge über `offset` stabil.
  const BESCHREIBUNG_PAGE_SIZE = 200;
  const beschreibungPages = Math.max(
    1,
    Math.ceil(orteBaseData.data.length / BESCHREIBUNG_PAGE_SIZE)
  );

  const orteTextPages = await Promise.all(
    Array.from({ length: beschreibungPages }, (_, page) =>
      fetchFromDirectus<Pick<DirectusOrte, "id" | "Vollbeschreibung">>(
        buildOrteUrl(["id", "Vollbeschreibung"], {
          limit: String(BESCHREIBUNG_PAGE_SIZE),
          offset: String(page * BESCHREIBUNG_PAGE_SIZE),
        }),
        "Orte"
      )
    )
  );

  const beschreibungById = new Map(
    orteTextPages.flatMap((p) =>
      p.data.map((o) => [o.id, o.Vollbeschreibung] as const)
    )
  );

  const orteData: DirectusCollectionResponse<DirectusOrte> = {
    ...orteBaseData,
    data: orteBaseData.data.map((o) => ({
      ...o,
      Vollbeschreibung: beschreibungById.get(o.id) ?? undefined,
    })),
  };

  // ========================================
  // FETCH KATEGORIEN - Updated with Beschreibung
  // ========================================

  const kategorieUrl = new URL(`${baseUrl}/items/Kategorie`);
  kategorieUrl.searchParams.set("fields", "id,Name,Farbe,Beschreibung,Reihenfolge");
  kategorieUrl.searchParams.set("limit", "-1");
  kategorieUrl.searchParams.set("sort", "Reihenfolge");

  const kategorieData = await fetchFromDirectus<DirectusKategorie>(
    kategorieUrl.toString(),
    "Kategorien"
  );

  // ========================================
  // DATA TRANSFORMATION
  // ========================================

  const places: Place[] = orteData.data
    .map(transformDirectusOrteToPlace)
    .filter((place): place is Place => place !== null);

  const categories: Category[] = kategorieData.data
    .map((kat) => ({
      id: kat.id,
      name: kat.Name.trim(),
      color: kat.Farbe.trim(),
      description: kat.Beschreibung?.trim(), // Added description mapping
    }))
    .filter((cat) => cat.name.length > 0 && cat.color.length > 0);

  // Die Info-Blase über gesperrten Sehenswertes-Pins entfällt — es gibt kein
  // Gating für Einzelnutzer mehr (siehe MapBoxMap.tsx). Damit fällt auch der
  // Directus-Abruf von sights_lock_modal_content weg; die Kollektion bleibt
  // dort bestehen, falls das Modell je zurückkehrt.

  // ========================================
  // DATA VALIDATION
  // ========================================

  console.log(`✅ Erfolgreich geladen:`);
  console.log(`   - ${places.length} von ${orteData.data.length} Orte`);
  console.log(
    `   - ${categories.length} von ${kategorieData.data.length} Kategorien`
  );

  if (places.length === 0) {
    console.warn("⚠️  Keine gültigen Orte gefunden");
  }

  if (categories.length === 0) {
    console.warn("⚠️  Keine gültigen Kategorien gefunden");
  }

  const placesWithoutCategories = places.filter(
    (p) => p.Kategorie.length === 0
  );
  if (placesWithoutCategories.length > 0) {
    console.warn(
      `⚠️  ${placesWithoutCategories.length} Orte ohne Kategorien:`,
      placesWithoutCategories.map((p) => `${p.Name} (ID: ${p.id})`)
    );
  }

  // ========================================
  // RENDER COMPONENT
  // ========================================

  return (
    <div>
      {/* SSR TREŚĆ - UKRYTA DLA GOOGLE */}
      <div
        style={{
          position: "absolute",
          left: "-9999px",
          width: "1px",
          height: "1px",
          overflow: "hidden",
        }}
      >
        <h1>Interaktive Karte - {places.length} Orte entdecken</h1>
        <p>
          Entdecken Sie {places.length} interessante Orte in{" "}
          {categories.length} Kategorien am Bodensee und im Allgäu.
        </p>

        <h2>Verfügbare Kategorien:</h2>
        <ul>
          {categories.map((category: Category) => (
            <li key={category.id}>{category.name}</li>
          ))}
        </ul>

        <h2>Ausgewählte Orte:</h2>
        {places.slice(0, 10).map((place: Place) => (
          <div key={place.id}>
            <h3>{place.Name}</h3>
            <p>📍 {place.Adresse}</p>
            {place.Vollbeschreibung && (
              <p>
                {place.Vollbeschreibung.replace(/<[^>]*>/g, "").substring(
                  0,
                  200
                )}
              </p>
            )}
            <div>
              Kategorien:{" "}
              {place.Kategorie.map((kat: Category) => kat.name).join(", ")}
            </div>
          </div>
        ))}
      </div>

      {/* MAPA OWRAPOWANA W CONDITIONAL MAPBOX */}
      <ConditionalMapbox>
        <MapRealtimeRefresh />
        <ErrorBoundary
          fallback={
            <div
              style={{
                padding: "2rem",
                textAlign: "center",
                backgroundColor: "#fee",
                border: "1px solid #fcc",
                borderRadius: "8px",
                margin: "2rem",
                maxWidth: "800px",
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              <h2>Fehler beim Laden der Kartenkomponente</h2>
              <p>Die interaktive Karte konnte nicht geladen werden.</p>
              <p
                style={{
                  fontSize: "0.9em",
                  color: "#666",
                  marginTop: "1rem",
                }}
              >
                Bitte versuchen Sie, die Seite zu aktualisieren oder
                kontaktieren Sie den Support.
              </p>
            </div>
          }
        >
          <MapWithFilters places={places} categories={categories} />
        </ErrorBoundary>
      </ConditionalMapbox>
    </div>
  );
}

// ========================================
// METADATA EXPORT
// ========================================

export const metadata: Metadata = {
  title: "Interaktive Karte",
  description: "Entdecken Sie interessante Orte auf unserer interaktiven Karte",
  keywords: ["Karte", "Orte", "Standorte", "Navigation"],
};

// Note: Removed conflicting 'export const dynamic = "force-dynamic"'
// ISR with revalidate=86400 is the correct caching strategy for this page
