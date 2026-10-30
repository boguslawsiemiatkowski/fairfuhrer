// Kachelgitter einer Stadt-Übersicht. Eigene Datei, damit die Seite selbst
// eine Server Component bleibt und nur das Gitter-Markup hier liegt.
import PlaceCard from "@/components/PlaceCard";
import type { Place } from "@/types";
import styles from "./page.module.css";

export default function StadtKarten({ places }: { places: Place[] }) {
  if (places.length === 0) return null;

  return (
    <ul className={styles.cards}>
      {places.map((place) => (
        <PlaceCard key={place.id} place={place} hideCity />
      ))}
    </ul>
  );
}
