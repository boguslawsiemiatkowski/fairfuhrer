// app/liste/[stadt]/[slug]/page.tsx
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
  MoveRight,
  MapPinHouse,
  Map,
  Navigation,
  Footprints,
  Bike,
  Car,
} from "lucide-react";
import BackToListeLink from "@/components/BackToListeLink";
import ColumnAudioPlayer from "@/components/ColumnAudioPlayer";
import CategoryIcon, { categoryColorFor } from "@/components/CategoryIcon";
import PlaceGallery from "@/components/PlaceGallery";
import {
  cityToSegment,
  fetchAllPlaces,
  findPlaceBySlug,
  formatDistance,
  pickDiscovery,
  htmlToPlainText,
  galleryUrls,
  mainImageUrl,
  sanitizeExternalUrl,
  sanitizeWordHtml,
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

  const canonical = `${SITE_URL}/liste/${stadt}/${slug}`;

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

export default async function OrtPage({ params }: RouteParams) {
  const { stadt, slug } = await params;
  const place = await getPlace(stadt, slug);

  if (!place) notFound();

  const canonical = `${SITE_URL}/liste/${stadt}/${slug}`;
  const directusUrl = process.env.NEXT_PUBLIC_DIRECTUS_URL;

  const audio = audioSrc(place);
  // Beide Bildformen: nur 197 von 592 Orten haben ein Directus-`Titelbild`,
  // 574 dagegen ein `Hauptbild` in Supabase Storage.
  const heroUrl = mainImageUrl(place);
  const galerie = galleryUrls(place);
  const zertifizierungen = place.Zertifizierungen ?? [];
  const firstCategory = place.Kategorie[0];
  const sidebarColor = categoryColorFor(firstCategory);
  const safeLinkUrl = sanitizeExternalUrl(place.Link_URL);
  const safeDescription = place.Vollbeschreibung
    ? sanitizeWordHtml(place.Vollbeschreibung)
    : undefined;

  // „Entdeckung in der Nähe": ein anderer Pin im Ring 400 m .. 12 km, über
  // den eigenen slug ausgewählt. fetchAllPlaces() liegt im Cache, der zweite
  // Aufruf kostet keine weitere Anfrage.
  const discovery = pickDiscovery(place, await fetchAllPlaces());
  const discoveryHref =
    discovery && cityToSegment(discovery.place.Stadt)
      ? `/liste/${cityToSegment(discovery.place.Stadt)}/${discovery.place.slug}`
      : null;

  const pinIdentifier = encodeURIComponent(place.slug || String(place.id));
  const mapPinHref = `/karte?pin=${pinIdentifier}`;
  const mapRouteWalkingHref = `/karte?pin=${pinIdentifier}&route=walking`;
  const mapRouteCyclingHref = `/karte?pin=${pinIdentifier}&route=cycling`;
  const mapRouteDrivingHref = `/karte?pin=${pinIdentifier}&route=driving`;

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
            Farbe der Kategorie (abgedunkelt, siehe categoryColor), damit schon
            am Farbton erkennbar ist, worum es geht. */}
        <aside className={styles.sidebar} style={{ backgroundColor: sidebarColor }}>
          {/* Zurück zur Liste (mit Wiederherstellung der zuletzt gewählten Filter).
              Absolut positioniert, damit der Inhalt der Spalte mittig bleibt;
              verankert an `.layout`, weil `.sidebar` mit `overflow-y: auto`
              absolut positionierte Kinder abschneidet. */}
          <BackToListeLink
            className={styles.backTop}
            labelClassName={styles.backTopLabel}
          />

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

            {safeLinkUrl && (
              <p className={styles.contactLine}>
                <a
                  href={safeLinkUrl}
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
            {/* Absichtlich ohne Namen des Ziels: was dort wartet, soll eine
                Überraschung bleiben. Die Entfernung steht dabei, damit
                erkennbar ist, dass es in der Nähe liegt. Gewählt wird nicht
                der nächstgelegene Pin, sondern einer im Ring 400 m .. 12 km
                — siehe pickDiscovery(). */}
            {discoveryHref && discovery && (
              <Link href={discoveryHref} className={styles.discovery}>
                <span className={styles.discoveryLabel}>
                  Entdeckung in der Nähe
                </span>
                <span className={styles.discoveryMeta}>
                  {formatDistance(discovery.meters)}
                  <MoveRight size={18} aria-hidden="true" />
                </span>
              </Link>
            )}

            {heroUrl && (
              <figure className={styles.heroFigure}>
                <Image
                  src={heroUrl}
                  alt={place.Name}
                  width={900}
                  height={600}
                  priority
                  sizes="(max-width: 900px) 100vw, 60vw"
                  className={styles.heroImage}
                />
              </figure>
            )}

            {safeDescription ? (
              <div
                className={styles.description}
                dangerouslySetInnerHTML={{ __html: safeDescription }}
              />
            ) : (
              <p className={styles.noText}>
                Für diesen Ort liegt noch keine Beschreibung vor.
              </p>
            )}

            {/* Zertifikate am Ende des Textes, mittig und ohne Überschrift.
                Der Name erscheint beim Überfahren — zuvor stand die Reihe
                absolut oben links, wo sie bei mehreren Zeichen in das
                Titelbild hineinreichte. */}
            {zertifizierungen.length > 0 && directusUrl && (
              <div className={styles.zertRow} aria-label="Zertifizierungen">
                {zertifizierungen.map((zert) =>
                  zert.imageUuid ? (
                    <span key={zert.id} className={styles.zertItem}>
                      <Image
                        src={`${directusUrl}/assets/${zert.imageUuid}`}
                        alt={zert.name}
                        // Die wahren Maße kennt nur die Datei. Diese Werte
                        // dienen nur dem Platzhalter-Verhältnis; `width:auto`
                        // und `max-height` im CSS entscheiden, wie groß das
                        // Zeichen am Ende erscheint.
                        width={300}
                        height={150}
                        sizes="160px"
                        className={styles.zertBadge}
                      />
                      <span className={styles.zertTooltip}>{zert.name}</span>
                    </span>
                  ) : (
                    <span key={zert.id} className={styles.zertText}>
                      {zert.name}
                    </span>
                  ),
                )}
              </div>
            )}

            {galerie.length > 0 && (
              <section className={styles.gallerySection} aria-labelledby="galerie">
                <h2 id="galerie" className={styles.galleryTitle}>
                  Bildergalerie
                </h2>
                <PlaceGallery images={galerie} name={place.Name} />
              </section>
            )}

            {/* Zamiast odizolowanej mini-mapy WebGL: bezpośrednie przejście do otwartego
                panelu tego pinu na głównej mapie /karte oraz szybkie uruchomienie planera trasy */}
            <section className={styles.mapSection} aria-labelledby="lage">
              <h2 id="lage" className={styles.galleryTitle}>
                Lage &amp; Routenplaner
              </h2>

              <div className={styles.locationCard}>
                <div className={styles.locationCardHeader}>
                  <span
                    className={styles.locationIconBadge}
                    style={{ backgroundColor: sidebarColor }}
                    aria-hidden="true"
                  >
                    <MapPinHouse size={22} />
                  </span>
                  <div className={styles.locationAddressBlock}>
                    <h3 className={styles.locationPlaceName}>{place.Name}</h3>
                    <p className={styles.locationAddressText}>
                      {[
                        place.Adresse,
                        [place.Stadt, place.Land].filter(Boolean).join(", "),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>

                <p className={styles.locationCardHint}>
                  Öffnen Sie diesen Ort direkt im Informationspanel auf unserer
                  interaktiven FairFührer-Karte, um benachbarte Pins in der
                  Umgebung zu entdecken oder Ihre Route direkt auf der Karte zu
                  berechnen:
                </p>

                <div className={styles.locationPrimaryAction}>
                  <Link href={mapPinHref} className={styles.openOnMapButton}>
                    <span className={styles.openOnMapButtonLabel}>
                      <Map size={18} aria-hidden="true" />
                      <span>Pin auf der FairFührer-Karte öffnen</span>
                    </span>
                    <MoveRight size={18} aria-hidden="true" />
                  </Link>
                </div>

                <div className={styles.routeQuickBlock}>
                  <span className={styles.routeQuickTitle}>
                    <Navigation size={14} aria-hidden="true" />
                    <span>Direkt Route auf der Karte planen:</span>
                  </span>

                  <div className={styles.routeQuickButtons}>
                    <Link
                      href={mapRouteWalkingHref}
                      className={styles.routeQuickBtn}
                    >
                      <Footprints size={16} aria-hidden="true" />
                      <span>Zu Fuß</span>
                    </Link>

                    <Link
                      href={mapRouteCyclingHref}
                      className={styles.routeQuickBtn}
                    >
                      <Bike size={16} aria-hidden="true" />
                      <span>Fahrrad</span>
                    </Link>

                    <Link
                      href={mapRouteDrivingHref}
                      className={styles.routeQuickBtn}
                    >
                      <Car size={16} aria-hidden="true" />
                      <span>Auto</span>
                    </Link>
                  </div>
                </div>
              </div>
            </section>

            <p className={styles.backLink}>
              <Link href="/liste">Alle Orte durchsuchen</Link>
            </p>
          </div>
        </div>
      </article>
    </>
  );
}
