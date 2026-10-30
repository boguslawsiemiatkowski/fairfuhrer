// app/orte/[stadt]/page.tsx
//
// Stadt-Übersicht: alle Orte einer Stadt an einer Adresse. Entsteht praktisch
// gratis aus der URL-Struktur /orte/[stadt]/[slug] und ist für Suchanfragen
// wie "nachhaltig einkaufen Lindau" die passende Landeseite — eine Ebene
// zwischen /liste und den einzelnen Pins.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  cityToSegment,
  fetchAllPlaces,
  groupByCity,
  hasAudio,
} from "@/lib/orte";
import StadtKarten from "./StadtKarten";
import styles from "./page.module.css";

export const revalidate = 86400;

const SITE_URL = "https://www.fairfuehrer.guide";

interface RouteParams {
  params: Promise<{ stadt: string }>;
}

export async function generateStaticParams() {
  const places = await fetchAllPlaces();
  return groupByCity(places).map((city) => ({ stadt: city.segment }));
}

async function getCity(segment: string) {
  const places = await fetchAllPlaces();
  return groupByCity(places).find((c) => c.segment === segment) ?? null;
}

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { stadt } = await params;
  const city = await getCity(stadt);

  if (!city) return { title: "Stadt nicht gefunden" };

  const audioCount = city.places.filter(hasAudio).length;
  const title = `Nachhaltige Orte in ${city.name}`;
  const description = `${city.places.length} nachhaltige Orte in ${city.name}${
    audioCount > 0 ? `, davon ${audioCount} mit Audioguide` : ""
  } — entdecken Sie sie mit dem Fairführer.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/orte/${stadt}` },
    openGraph: {
      type: "website",
      title,
      description,
      url: `${SITE_URL}/orte/${stadt}`,
      siteName: "Fairführer",
      locale: "de_DE",
    },
  };
}

export default async function StadtPage({ params }: RouteParams) {
  const { stadt } = await params;
  const city = await getCity(stadt);

  if (!city) notFound();

  const audioCount = city.places.filter(hasAudio).length;

  // Kategorien dieser Stadt mit Anzahl — zeigt auf einen Blick, was es hier
  // gibt, ohne eigene Filter-Logik auf dieser Ebene.
  const categoryCounts = new Map<string, number>();
  for (const place of city.places) {
    for (const cat of place.Kategorie) {
      categoryCounts.set(cat.name, (categoryCounts.get(cat.name) ?? 0) + 1);
    }
  }
  const categories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Nachhaltige Orte in ${city.name}`,
    url: `${SITE_URL}/orte/${stadt}`,
    numberOfItems: city.places.length,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />

      <main className={styles.page}>
        <nav className={styles.breadcrumb} aria-label="Brotkrümelnavigation">
          <Link href="/liste">Alle Orte</Link>
          <span aria-hidden="true">›</span>
          <span aria-current="page">{city.name}</span>
        </nav>

        <header className={styles.intro}>
          <h1 className={styles.title}>{city.name}</h1>
          <p className={styles.subtitle}>
            {city.places.length}{" "}
            {city.places.length === 1 ? "Ort" : "Orte"} in {city.name}
            {audioCount > 0 && <>, davon {audioCount} mit Audioguide</>}.
          </p>

          {categories.length > 0 && (
            <ul className={styles.categoryList}>
              {categories.map(([name, count]) => (
                <li key={name} className={styles.categoryItem}>
                  {name} <span className={styles.categoryCount}>{count}</span>
                </li>
              ))}
            </ul>
          )}
        </header>

        <StadtKarten places={city.places} />

        <p className={styles.footerLinks}>
          <Link href="/liste">Alle Orte durchsuchen</Link>
          <span aria-hidden="true"> · </span>
          <Link href="/karte">Auf der Karte ansehen</Link>
        </p>
      </main>
    </>
  );
}
