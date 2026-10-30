// app/liste/ListeFallback.tsx
//
// Serverseitig gerenderte Fassung der Liste. Sie steht im Suspense-Fallback
// von /liste und erfüllt zwei Aufgaben:
//
//  1. Suchmaschinen und Browser ohne JavaScript bekommen die vollständige
//     Liste samt Links auf alle Detailseiten. Stünde hier nur „wird geladen“,
//     wäre die Seite für Google praktisch leer — und genau sie soll die
//     Audiopins auffindbar machen.
//  2. Beim ersten Rendern ist sofort Inhalt sichtbar; die interaktiven Filter
//     ersetzen ihn, sobald sie hydriert sind.
//
// Bewusst ohne Filter-UI: dieses Markup kann nicht auf Klicks reagieren.
import Link from "next/link";
import PlaceCard from "@/components/PlaceCard";
import type { CityGroup } from "@/lib/orte";
import styles from "./page.module.css";

interface ListeFallbackProps {
  cities: CityGroup[];
  totalPlaces: number;
}

/** So viele Städte zeigen die Kacheln direkt; der Rest nur als Link. */
const CITIES_WITH_CARDS = 12;

export default function ListeFallback({
  cities,
  totalPlaces,
}: ListeFallbackProps) {
  // Größte Städte zuerst — dort steckt der meiste Inhalt.
  const sorted = [...cities].sort(
    (a, b) => b.places.length - a.places.length || a.name.localeCompare(b.name, "de"),
  );
  const withCards = sorted.slice(0, CITIES_WITH_CARDS);
  const linkOnly = sorted.slice(CITIES_WITH_CARDS);

  return (
    <>
      <div className={styles.resultBar}>
        <p className={styles.resultCount}>{totalPlaces} Orte</p>
      </div>

      {withCards.map((city) => (
        <section key={city.segment} className={styles.cityGroup}>
          <h2 className={styles.cityHeading}>
            <Link href={`/orte/${city.segment}`} className={styles.cityLink}>
              {city.name}
              <span className={styles.cityCount}>{city.places.length}</span>
            </Link>
          </h2>
          <ul className={styles.cards}>
            {city.places.map((place) => (
              <PlaceCard key={place.id} place={place} hideCity />
            ))}
          </ul>
        </section>
      ))}

      {linkOnly.length > 0 && (
        <section className={styles.cityGroup}>
          <h2 className={styles.cityHeading}>
            <span className={styles.cityLink}>Weitere Städte</span>
          </h2>
          <ul className={styles.cityIndex}>
            {linkOnly.map((city) => (
              <li key={city.segment}>
                <Link href={`/orte/${city.segment}`}>
                  {city.name}
                  <span className={styles.cityCount}>{city.places.length}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
