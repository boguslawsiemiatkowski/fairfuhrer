// app/sitemap.ts
//
// Vorher standen hier nur die acht statischen Seiten — die 592 Orte und die
// Stadt-Übersichten fehlten vollständig, obwohl sie den Großteil des Inhalts
// ausmachen. Jetzt kommen sie aus Directus dazu.
//
// Kein `changefreq` und kein `priority`: Google wertet beide nicht aus und
// sagt das ausdrücklich. Gelesen wird allein `lastmod` — und das nur, solange
// es stimmt. Ein pauschales „weekly" für Seiten, die sich selten ändern,
// nützt also nichts und untergräbt im Zweifel das Vertrauen in unsere Daten.
import type { MetadataRoute } from "next";
import { cityToSegment, fetchPlacesForSitemap } from "@/lib/orte";

const BASE_URL = "https://www.fairfuehrer.guide";

// Gleicher Rhythmus wie die Seiten selbst (revalidate = 86400), damit neue
// Pins spätestens nach einem Tag in der Sitemap stehen.
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    "",
    "/karte",
    "/liste",
    "/ueber-uns",
    "/partner-werden",
    "/partner-werden/voraussetzungen",
    "/kontakt",
    "/impressum",
    "/datenschutz",
    "/agb",
  ].map((path) => ({ url: `${BASE_URL}${path}`, lastModified }));

  // Fällt Directus aus, soll die Sitemap nicht leer werden: dann bleiben
  // wenigstens die statischen Seiten drin, statt dass die Route einen Fehler
  // wirft und Google gar nichts bekommt.
  let places;
  try {
    places = await fetchPlacesForSitemap();
  } catch (error) {
    console.error("Sitemap: Orte konnten nicht geladen werden:", error);
    return staticEntries;
  }

  // Stadt-Übersichten stehen hier bewusst nicht mehr: die Route
  // /liste/[stadt] ist entfallen, die Adressen liefern 404. Sie in der
  // Sitemap zu melden, hieße Google 155 fehlende Seiten anzubieten. SEO für
  // Städte soll über Blogbeiträge kommen, nicht über generierte Pin-Listen.

  // Detailseiten. Ohne slug oder Stadt gibt es keine Seite (siehe
  // generateStaticParams der Route), also auch keinen Sitemap-Eintrag.
  const placeEntries: MetadataRoute.Sitemap = places
    .map((place) => {
      const segment = cityToSegment(place.Stadt);
      if (!segment || !place.slug) return null;
      return { url: `${BASE_URL}/liste/${segment}/${place.slug}`, lastModified };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return [...staticEntries, ...placeEntries];
}
