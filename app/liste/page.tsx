// app/liste/page.tsx
//
// Dritte Art, den Fairführer zu nutzen — neben der Karte und der App: ein
// durchsuchbarer Katalog aller Audiopins. Die Karte zeigt, WO etwas ist; die
// Liste hilft, etwas zu FINDEN, und führt auf die Detailseiten.
//
// Daten kommen auf dem Server (ISR, vorgerendert); das Filtern läuft im
// Browser, damit es ohne Nachladen reagiert.
import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchAllPlaces, fetchCategories, groupByCity } from "@/lib/orte";
import OrteListe from "./OrteListe";
import ListeFallback from "./ListeFallback";
import styles from "./page.module.css";

export const revalidate = 86400;

const SITE_URL = "https://www.fairfuehrer.guide";

export const metadata: Metadata = {
  title: "Alle Orte in der Übersicht",
  description:
    "Alle nachhaltigen Orte am Bodensee und im Allgäu auf einen Blick — mit Audioguides, nach Stadt und Kategorie filterbar.",
  alternates: { canonical: `${SITE_URL}/liste` },
  openGraph: {
    type: "website",
    title: "Alle Orte in der Übersicht",
    description:
      "Alle nachhaltigen Orte am Bodensee und im Allgäu auf einen Blick — mit Audioguides, nach Stadt und Kategorie filterbar.",
    url: `${SITE_URL}/liste`,
    siteName: "Fairführer",
    locale: "de_DE",
  },
};

export default async function ListePage() {
  const [places, categories] = await Promise.all([
    fetchAllPlaces(),
    fetchCategories(),
  ]);

  const cities = groupByCity(places);

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <h1 className={styles.title}>Alle Orte</h1>
        <p className={styles.subtitle}>
          {places.length} Orte in {cities.length} Städten am Bodensee und im
          Allgäu — nachhaltig geführt, fast alle mit Audioguide.
        </p>
      </header>

      {/* Die Filter lesen ihren Zustand über useSearchParams aus der URL; beim
          Vorrendern steht die Query noch nicht fest, daher die Suspense-Grenze.
          Im Fallback steht die vollständige, serverseitig gerenderte Liste —
          so sehen Google und Browser ohne JavaScript alle Orte und Links,
          statt nur „wird geladen“. */}
      <Suspense
        fallback={
          <ListeFallback cities={cities} totalPlaces={places.length} />
        }
      >
        <OrteListe places={places} categories={categories} />
      </Suspense>
    </main>
  );
}
