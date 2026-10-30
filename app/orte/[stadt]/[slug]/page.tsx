// app/orte/[stadt]/[slug]/page.tsx
//
// Eigene, von Google indexierbare Seite je Audiopin. Vorher war die ganze
// Karte für Suchmaschinen eine einzige Seite — 592 Orte mit 575 ausführlichen
// Beschreibungen blieben praktisch unsichtbar.
//
// Alle Seiten werden beim Build vorgerendert (generateStaticParams). Das macht
// den Deploy länger, liefert aber sofortige Seiten, die auch dann noch
// ausgeliefert werden, wenn Directus gerade nicht antwortet.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ColumnAudioPlayer from "@/components/ColumnAudioPlayer";
import CategoryIcon, { CATEGORY_COLORS } from "@/components/CategoryIcon";
import {
  cityToSegment,
  fetchAllPlaces,
  findPlaceBySlug,
  htmlToPlainText,
  mainImageUrl,
  truncateAtWord,
} from "@/lib/orte";
import { getAudioUrl } from "@/lib/supabase";
import type { Place } from "@/types";
import styles from "./page.module.css";

export const revalidate = 86400;

const SITE_URL = "https://www.fairfuehrer.guide";

interface RouteParams {
  params: Promise<{ stadt: string; slug: string }>;
}

/**
 * Baut die Liste aller Detailseiten für das Vorrendern. Orte ohne `slug`
 * werden übersprungen: sie bleiben auf der Karte, bekommen aber keine eigene
 * Seite — so lässt sich ein Pin in Directus bewusst aus dem Index halten.
 */
export async function generateStaticParams() {
  const places = await fetchAllPlaces();
  return places
    .filter((p) => p.slug && cityToSegment(p.Stadt))
    .map((p) => ({ stadt: cityToSegment(p.Stadt), slug: p.slug! }));
}

async function getPlace(stadt: string, slug: string): Promise<Place | null> {
  const places = await fetchAllPlaces();
  return findPlaceBySlug(places, stadt, slug);
}

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { stadt, slug } = await params;
  const place = await getPlace(stadt, slug);

  if (!place) return { title: "Ort nicht gefunden" };

  const plain = htmlToPlainText(place.Vollbeschreibung);
  const city = place.Stadt ? ` in ${place.Stadt}` : "";
  const description = plain
    ? truncateAtWord(plain, 155)
    : `${place.Name}${city} — entdecken Sie nachhaltige Orte am Bodensee und im Allgäu mit dem Fairführer.`;

  const imageUrl = mainImageUrl(place) ?? undefined;

  const canonical = `${SITE_URL}/orte/${stadt}/${slug}`;

  return {
    title: `${place.Name}${city}`,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title: `${place.Name}${city}`,
      description,
      url: canonical,
      siteName: "Fairführer",
      locale: "de_DE",
      ...(imageUrl ? { images: [{ url: imageUrl }] } : {}),
    },
  };
}

/**
 * schema.org-Daten. `TouristAttraction` beschreibt den Ort selbst,
 * `AudioObject` den zugehörigen Audioguide — danach kann Google in den
 * Suchergebnissen auf den Audioguide hinweisen.
 */
function buildStructuredData(place: Place, canonical: string) {
  const directusUrl = process.env.NEXT_PUBLIC_DIRECTUS_URL;
  const plain = htmlToPlainText(place.Vollbeschreibung);
  const heroUrl = mainImageUrl(place);

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    name: place.Name,
    url: canonical,
    ...(plain ? { description: truncateAtWord(plain, 500) } : {}),
    ...(heroUrl ? { image: heroUrl } : {}),
    address: {
      "@type": "PostalAddress",
      ...(place.Adresse ? { streetAddress: place.Adresse } : {}),
      ...(place.Stadt ? { addressLocality: place.Stadt } : {}),
      ...(place.Land ? { addressCountry: place.Land } : {}),
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: place.location.coordinates[1],
      longitude: place.location.coordinates[0],
    },
    ...(place.Telefon ? { telephone: place.Telefon } : {}),
    ...(place.Link_URL ? { sameAs: place.Link_URL } : {}),
    ...(place.Kategorie.length
      ? { touristType: place.Kategorie.map((k) => k.name) }
      : {}),
  };

  // Audio liegt in zwei Formen vor: neuere Pins verweisen über `Audio` auf
  // eine Directus-Datei, ältere über `Audio_Datei` auf Supabase Storage.
  // Beide müssen hier auftauchen — sonst wäre der Audioguide nur bei 35 von
  // 591 Seiten ausgezeichnet, obwohl fast alle einen haben.
  const audioUrl =
    place.Audio && directusUrl
      ? `${directusUrl}/assets/${place.Audio}`
      : place.Audio_Datei
        ? getAudioUrl(place.id, place.Audio_Datei)
        : null;

  if (audioUrl) {
    data.subjectOf = {
      "@type": "AudioObject",
      name: `Audioguide: ${place.Name}`,
      contentUrl: audioUrl,
      inLanguage: "de",
      ...(heroUrl ? { thumbnailUrl: heroUrl } : {}),
    };
  }

  return data;
}

/** Quelle des Audioguides, beide Ablageformen berücksichtigt. */
function audioSrc(place: Place): string | null {
  const directusUrl = process.env.NEXT_PUBLIC_DIRECTUS_URL;
  if (place.Audio && directusUrl) return `${directusUrl}/assets/${place.Audio}`;
  if (place.Audio_Datei) return getAudioUrl(place.id, place.Audio_Datei);
  return null;
}

/**
 * Hintergrund der linken Spalte: die Kategoriefarbe, um 50 % abgedunkelt.
 *
 * Nötig, weil die Farben aus Directus für weiße Schrift viel zu hell sind —
 * gemessen: Gelb #E0D12E kommt auf 1,58:1, Grün #42D742 auf 1,90:1, verlangt
 * sind 4,5:1. Um 50 % abgedunkelt liegen alle fünf Kategorien über 5,6:1 und
 * bleiben trotzdem als ihre Farbe erkennbar.
 */
function columnColor(hex: string | undefined, fallback: string): string {
  const source = /^#[0-9a-f]{6}$/i.test(hex ?? "") ? hex! : fallback;
  const dim = (from: number) =>
    Math.round(parseInt(source.slice(from, from + 2), 16) * 0.5);
  return `rgb(${dim(1)}, ${dim(3)}, ${dim(5)})`;
}

export default async function OrtPage({ params }: RouteParams) {
  const { stadt, slug } = await params;
  const place = await getPlace(stadt, slug);

  if (!place) notFound();

  const canonical = `${SITE_URL}/orte/${stadt}/${slug}`;
  const directusUrl = process.env.NEXT_PUBLIC_DIRECTUS_URL;

  // Beide Bildformen berücksichtigen — nur 197 von 592 Orten haben ein
  // Directus-`Titelbild`, 574 dagegen ein `Hauptbild` in Supabase Storage.
  const audio = audioSrc(place);
  const firstCategory = place.Kategorie[0];
  const sidebarColor = columnColor(
    firstCategory?.color || CATEGORY_COLORS[firstCategory?.id ?? 0],
    "#fc6c14",
  );

  return (
    <>
      <script
        type="application/ld+json"
        // Daten stammen aus Directus und werden über JSON.stringify
        // eingebettet; `<` wird maskiert, damit kein Tag aus dem Script
        // ausbrechen kann.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildStructuredData(place, canonical)).replace(
            /</g,
            "\\u003c",
          ),
        }}
      />

      <article className={styles.layout}>
        {/* Linke Spalte: steht fest, scrollt nicht mit. Hintergrund ist die
            Farbe der Kategorie (abgedunkelt, siehe columnColor), damit schon
            am Farbton erkennbar ist, worum es geht. */}
        <aside className={styles.sidebar} style={{ backgroundColor: sidebarColor }}>
          <div className={styles.sidebarInner}>
            {firstCategory && (
              <p className={styles.category}>
                <CategoryIcon
                  categoryId={firstCategory.id}
                  color="rgba(255,255,255,0.22)"
                  strokeColor="#fff"
                  size={34}
                />
                {firstCategory.name}
              </p>
            )}

            <h1 className={styles.title}>{place.Name}</h1>

            <p className={styles.address}>
              {place.Adresse}
              {place.Stadt && (
                <>
                  <br />
                  {place.Stadt}
                  {place.Land ? `, ${place.Land}` : ""}
                </>
              )}
            </p>

            {place.Telefon && (
              <p className={styles.contactLine}>
                <a href={`tel:${place.Telefon.replace(/\s+/g, "")}`}>
                  {place.Telefon}
                </a>
              </p>
            )}

            {place.Link_URL && (
              <p className={styles.contactLine}>
                <a
                  href={place.Link_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {place.Link_Text || "Website besuchen"}
                </a>
              </p>
            )}

            {audio && (
              <div className={styles.playerWrap}>
                <ColumnAudioPlayer src={audio} title={place.Name} />
              </div>
            )}
          </div>
        </aside>

        {/* Rechte Spalte: der Text, hier wird gescrollt. */}
        <div className={styles.main}>
          <div className={styles.mainInner}>
            {place.Vollbeschreibung ? (
              <div
                className={styles.description}
                dangerouslySetInnerHTML={{ __html: place.Vollbeschreibung }}
              />
            ) : (
              <p className={styles.noText}>
                Für diesen Ort liegt noch keine Beschreibung vor.
              </p>
            )}

            <p className={styles.backLink}>
              <Link href="/liste">Alle Orte durchsuchen</Link>
            </p>
          </div>
        </div>
      </article>
    </>
  );
}
