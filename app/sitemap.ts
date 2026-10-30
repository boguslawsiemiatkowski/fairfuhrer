// app/sitemap.ts
//
// Vorher standen hier nur die acht statischen Seiten — die 592 Orte und die
// Stadt-Übersichten fehlten vollständig, obwohl sie den Großteil des Inhalts
// ausmachen. Jetzt kommen sie aus Directus dazu.
import type { MetadataRoute } from "next";
import { fetchAllPlaces, groupByCity, placeHref } from "@/lib/orte";

const BASE_URL = "https://www.fairfuehrer.guide";

// Gleicher Rhythmus wie die Seiten selbst (revalidate = 86400), damit neue
// Pins spätestens nach einem Tag in der Sitemap stehen.
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/karte`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/liste`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/ueber-uns`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/partner-werden`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/partner-werden/voraussetzungen`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/kontakt`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/impressum`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/datenschutz`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/agb`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  // Fällt Directus aus, soll die Sitemap nicht leer werden: dann bleiben
  // wenigstens die statischen Seiten drin, statt dass die Route einen Fehler
  // wirft und Google gar nichts bekommt.
  let places;
  try {
    places = await fetchAllPlaces();
  } catch (error) {
    console.error("Sitemap: Orte konnten nicht geladen werden:", error);
    return staticEntries;
  }

  // Stadt-Übersichten. Priorität nach Anzahl der Orte: Lindau mit 71 Pins ist
  // als Landeseite mehr wert als ein Ort mit einem einzigen Pin.
  const cities = groupByCity(places);
  const maxCityPins = Math.max(1, ...cities.map((c) => c.places.length));

  const cityEntries: MetadataRoute.Sitemap = cities.map((city) => ({
    url: `${BASE_URL}/orte/${city.segment}`,
    lastModified,
    changeFrequency: "weekly" as const,
    // 0.5 bis 0.8, abhängig vom Umfang der Stadt.
    priority:
      Math.round((0.5 + 0.3 * (city.places.length / maxCityPins)) * 100) / 100,
  }));

  // Detailseiten. `placeHref` liefert null, wenn slug oder Stadt fehlen — dann
  // existiert auch keine Seite (siehe generateStaticParams der Route).
  const placeEntries: MetadataRoute.Sitemap = places
    .map((place) => {
      const href = placeHref(place);
      if (!href) return null;
      return {
        url: `${BASE_URL}${href}`,
        lastModified,
        changeFrequency: "monthly" as const,
        // Pins mit Audioguide sind die eigentliche Besonderheit des
        // Fairführers; sie bekommen etwas mehr Gewicht.
        priority: place.Audio || place.Audio_Datei ? 0.7 : 0.6,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return [...staticEntries, ...cityEntries, ...placeEntries];
}
