// app/karte/page.tsx
//
// Datenabruf und Transformation liegen in lib/orte.ts, damit Karte, Liste,
// Stadt-Hubs und Detailseiten dieselben Daten in derselben Form sehen.
import type { Metadata } from "next";
import MapWithFilters from "../../components/MapWithFilters";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { ConditionalMapbox } from "../../components/ConditionalMapbox";
import MapRealtimeRefresh from "../../components/MapRealtimeRefresh";
import { fetchPlacesForMap, fetchCategories } from "@/lib/orte";

// ISR revalidation - dane będą odświeżane co 24 godziny
// Miejsca turystyczne zmieniają się rzadko, dłuższy cache = lepsza wydajność
export const revalidate = 86400; // 24 hours

export default async function KartePage() {
  // Błędy pobierania danych celowo nie są tu łapane — obsługuje je
  // app/karte/error.tsx. Dzięki temu ISR przy nieudanej rewalidacji dalej
  // serwuje ostatnią poprawną wersję strony zamiast zapisywać w cache
  // strony błędu na 24 godziny.
  const [places, categories] = await Promise.all([
    fetchPlacesForMap(),
    fetchCategories(),
  ]);

  // Die Info-Blase über gesperrten Sehenswertes-Pins entfällt — es gibt kein
  // Gating für Einzelnutzer mehr (siehe MapBoxMap.tsx). Die Directus-Kollektion
  // sights_lock_modal_content bleibt bestehen, falls das Modell zurückkehrt.

  console.log(`✅ Erfolgreich geladen:`);
  console.log(`   - ${places.length} Orte`);
  console.log(`   - ${categories.length} Kategorien`);

  if (places.length === 0) console.warn("⚠️  Keine gültigen Orte gefunden");
  if (categories.length === 0) console.warn("⚠️  Keine gültigen Kategorien gefunden");

  const placesWithoutCategories = places.filter((p) => p.Kategorie.length === 0);
  if (placesWithoutCategories.length > 0) {
    console.warn(
      `⚠️  ${placesWithoutCategories.length} Orte ohne Kategorien:`,
      placesWithoutCategories.map((p) => `${p.Name} (ID: ${p.id})`),
    );
  }

  return (
    <div>
      {/* Der ausgeblendete SSR-Block ist entfallen. Er stand per
          `left: -9999px` außerhalb des Sichtfelds — genau das Muster, das
          Googles Spam-Richtlinien unter „versteckter Text" nennen. Getragen
          hat er ohnehin nichts: wer einen Ortsnamen sucht, findet jetzt
          dessen eigene Seite unter /liste/[stadt]/[slug], mit vollem Text
          und strukturierten Daten. Eine unsichtbare Liste von zehn Pins
          konnte dagegen nie konkurrieren. */}

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

export const metadata: Metadata = {
  title: "Interaktive Karte",
  description: "Entdecken Sie interessante Orte auf unserer interaktiven Karte",
  keywords: ["Karte", "Orte", "Standorte", "Navigation"],
};
