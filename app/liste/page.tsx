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
import { cityToSegment, fetchAllPlaces, fetchCategories } from "@/lib/orte";
import OrteListe from "./OrteListe";
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

  // Nur für die unsichtbare Überschrift: wie viele Städte vertreten sind.
  const cityCount = new Set(
    places.map((p) => cityToSegment(p.Stadt)).filter(Boolean),
  ).size;

  return (
    <main className={styles.page}>
      {/* Kein sichtbarer Titel — wie im Liste-Tab der App, wo sofort die
          Karten kommen. Für Suchmaschinen und Screenreader steht die
          Überschrift unsichtbar im Markup; <title> und <meta> liefert
          generateMetadata. */}
      <h1 className={styles.srOnly}>
        Alle Orte — {places.length} nachhaltige Orte in {cityCount} Städten am
        Bodensee und im Allgäu
      </h1>

      {/* Die Filter lesen ihren Zustand über useSearchParams aus der URL; beim
          Vorrendern steht die Query noch nicht fest, daher die Suspense-Grenze.
          Der Fallback bleibt bewusst LEER: vorher stand hier eine zweite,
          serverseitig gerenderte Liste für Google — die blitzte beim Laden
          kurz in einem anderen Layout auf. Auf dieser Seite zählt das Erlebnis
          der Leser; die Suchmaschinen-Arbeit leisten die einzelnen
          Audiopin-Seiten und später der Blog. */}
      <Suspense fallback={null}>
        <OrteListe places={places} categories={categories} />
      </Suspense>
    </main>
  );
}
