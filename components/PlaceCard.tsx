// components/PlaceCard.tsx
//
// Kachel eines Ortes: Bild links, Text rechts. Genutzt von /liste und von den
// Stadt-Übersichten /orte/[stadt] — bewusst ein Bauteil, damit beide Ansichten
// nicht auseinanderlaufen.
//
// Kein Client Component: die Kachel hat keine Interaktion außer dem Link.
import Link from "next/link";
import Image from "next/image";
import type { Place } from "@/types";
import {
  cityToSegment,
  htmlToPlainText,
  truncateAtWord,
} from "@/lib/orte-shared";
import styles from "./PlaceCard.module.css";

interface PlaceCardProps {
  place: Place;
  /** Stadtname ausblenden, wenn die ganze Seite schon eine Stadt zeigt. */
  hideCity?: boolean;
}

export default function PlaceCard({ place, hideCity = false }: PlaceCardProps) {
  const directusUrl = process.env.NEXT_PUBLIC_DIRECTUS_URL;
  const segment = cityToSegment(place.Stadt);
  const href = segment && place.slug ? `/orte/${segment}/${place.slug}` : null;

  const teaser = truncateAtWord(htmlToPlainText(place.Vollbeschreibung), 160);
  const imageUrl =
    place.Titelbild && directusUrl
      ? `${directusUrl}/assets/${place.Titelbild}`
      : null;

  const meta = [
    hideCity ? null : place.Stadt,
    place.Kategorie.map((c) => c.name).join(", ") || null,
  ]
    .filter(Boolean)
    .join(" · ");

  const body = (
    <>
      <div className={styles.image}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={place.Name}
            width={240}
            height={180}
            loading="lazy"
            sizes="(max-width: 700px) 110px, 150px"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span className={styles.imageFallback} aria-hidden="true" />
        )}
      </div>

      <div className={styles.body}>
        <h3 className={styles.title}>{place.Name}</h3>
        {meta && <p className={styles.meta}>{meta}</p>}
        {teaser && <p className={styles.teaser}>{teaser}</p>}
        {(place.Audio || place.Audio_Datei) && (
          <p className={styles.audio}>
            <span aria-hidden="true">▶</span> Audioguide
          </p>
        )}
      </div>
    </>
  );

  return (
    <li className={styles.card}>
      {href ? (
        <Link href={href} className={styles.link}>
          {body}
        </Link>
      ) : (
        // Ohne slug oder Stadt gibt es keine Detailseite — der Ort bleibt
        // sichtbar, nur ohne Verweis (z. B. die Fairbusiness-Zertifizierung,
        // die keiner Stadt zugeordnet ist).
        <div className={styles.link}>{body}</div>
      )}
    </li>
  );
}
