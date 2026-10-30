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
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  DirectusAudioPlayer,
  AudioPlayer,
} from "@/components/MediaComponents";
import {
  cityToSegment,
  fetchAllPlaces,
  findPlaceBySlug,
  galleryUrls,
  hasAudio,
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

export default async function OrtPage({ params }: RouteParams) {
  const { stadt, slug } = await params;
  const place = await getPlace(stadt, slug);

  if (!place) notFound();

  const canonical = `${SITE_URL}/orte/${stadt}/${slug}`;
  const directusUrl = process.env.NEXT_PUBLIC_DIRECTUS_URL;

  // Beide Bildformen berücksichtigen — nur 197 von 592 Orten haben ein
  // Directus-`Titelbild`, 574 dagegen ein `Hauptbild` in Supabase Storage.
  const heroUrl = mainImageUrl(place);
  const galerie = galleryUrls(place);

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

      <article className={styles.page}>
        <nav className={styles.breadcrumb} aria-label="Brotkrümelnavigation">
          <Link href="/liste">Alle Orte</Link>
          <span aria-hidden="true">›</span>
          <Link href={`/orte/${stadt}`}>{place.Stadt ?? stadt}</Link>
          <span aria-hidden="true">›</span>
          <span aria-current="page">{place.Name}</span>
        </nav>

        <header className={styles.header}>
          {place.Kategorie.length > 0 && (
            <div className={styles.badges}>
              {place.Kategorie.map((cat) => (
                <span
                  key={cat.id}
                  className={styles.badge}
                  style={{ backgroundColor: cat.color }}
                >
                  {cat.name}
                </span>
              ))}
            </div>
          )}

          <h1 className={styles.title}>{place.Name}</h1>

          <p className={styles.address}>
            {place.Adresse}
            {place.Stadt ? ` ${place.Stadt}` : ""}
            {place.Land ? ` (${place.Land})` : ""}
          </p>
        </header>

        {heroUrl && (
          <div className={styles.heroImage}>
            <Image
              src={heroUrl}
              alt={place.Name}
              width={1200}
              height={675}
              priority
              sizes="(max-width: 900px) 100vw, 900px"
              style={{ width: "100%", height: "auto" }}
            />
          </div>
        )}

        {hasAudio(place) && (
          <section className={styles.section} aria-labelledby="audio-heading">
            <h2 id="audio-heading" className={styles.sectionTitle}>
              Audioguide
            </h2>
            {place.Audio ? (
              <DirectusAudioPlayer uuid={place.Audio} />
            ) : (
              <AudioPlayer placeId={place.id} filename={place.Audio_Datei!} />
            )}
          </section>
        )}

        {place.Vollbeschreibung && (
          <section className={styles.section}>
            <div
              className={styles.description}
              dangerouslySetInnerHTML={{ __html: place.Vollbeschreibung }}
            />
          </section>
        )}

        {galerie.length > 0 && (
          <section className={styles.section} aria-labelledby="galerie-heading">
            <h2 id="galerie-heading" className={styles.sectionTitle}>
              Bildergalerie
            </h2>
            <div className={styles.gallery}>
              {galerie.map((url, index) => (
                <Image
                  key={url}
                  src={url}
                  alt={`${place.Name} — Bild ${index + 1}`}
                  width={400}
                  height={300}
                  loading="lazy"
                  sizes="(max-width: 600px) 50vw, 300px"
                  className={styles.galleryImage}
                  style={{ width: "100%", height: "auto" }}
                />
              ))}
            </div>
          </section>
        )}

        {place.Zertifizierungen && place.Zertifizierungen.length > 0 && (
          <section className={styles.section} aria-labelledby="zert-heading">
            <h2 id="zert-heading" className={styles.sectionTitle}>
              Zertifizierungen &amp; Labels
            </h2>
            <div className={styles.zertGrid}>
              {place.Zertifizierungen.map((zert) =>
                zert.imageUuid && directusUrl ? (
                  <Image
                    key={zert.id}
                    src={`${directusUrl}/assets/${zert.imageUuid}`}
                    alt={zert.name}
                    title={zert.name}
                    width={100}
                    height={80}
                    loading="lazy"
                    className={styles.zertLogo}
                    style={{
                      objectFit: "contain",
                      width: "auto",
                      height: "auto",
                      maxHeight: "80px",
                    }}
                  />
                ) : (
                  <span key={zert.id} className={styles.zertName}>
                    {zert.name}
                  </span>
                ),
              )}
            </div>
          </section>
        )}

        <section className={styles.section} aria-labelledby="kontakt-heading">
          <h2 id="kontakt-heading" className={styles.sectionTitle}>
            Kontakt &amp; Anfahrt
          </h2>
          <dl className={styles.contactList}>
            <dt>Adresse</dt>
            <dd>
              {place.Adresse}
              {place.Stadt ? `, ${place.Stadt}` : ""}
            </dd>

            {place.Telefon && (
              <>
                <dt>Telefon</dt>
                <dd>
                  <a href={`tel:${place.Telefon.replace(/\s+/g, "")}`}>
                    {place.Telefon}
                  </a>
                </dd>
              </>
            )}

            {place.Link_URL && (
              <>
                <dt>Website</dt>
                <dd>
                  <a
                    href={place.Link_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {place.Link_Text || "Website besuchen"}
                  </a>
                </dd>
              </>
            )}
          </dl>

          {/* Bewusst kein Link auf eine fremde Karte: die Navigation soll auf
              unserer eigenen Mapbox-Karte stattfinden. Eine Routenfunktion dort
              kann später folgen. */}
          <div className={styles.actions}>
            <Link href="/karte" className={styles.actionPrimary}>
              Auf der Karte ansehen
            </Link>
            <Link href={`/orte/${stadt}`} className={styles.actionSecondary}>
              Weitere Orte in {place.Stadt ?? stadt}
            </Link>
          </div>
        </section>
      </article>
    </>
  );
}
