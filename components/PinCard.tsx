// components/PinCard.tsx
//
// Genaue Entsprechung von components/PinCard.tsx der App: Bild über die ganze
// Karte, Gradient oben und unten, darunter die Kategorie-Symbole und mittig
// Name und Ort in Weiß.
//
// Unterschied zur App: kein Schloss-Zustand — im Web gibt es kein Gating mehr
// (siehe MapBoxMap.tsx). Statt router.push führt ein echter Link auf die
// Detailseite, damit Google ihm folgen kann.
import Link from "next/link";
import Image from "next/image";
import type { Place } from "@/types";
import CategoryIcon, { CATEGORY_COLORS } from "./CategoryIcon";
import { cityToSegment, mainImageUrl } from "@/lib/orte-shared";
import styles from "./PinCard.module.css";

export default function PinCard({ place }: { place: Place }) {
  const segment = cityToSegment(place.Stadt);
  const href = segment && place.slug ? `/orte/${segment}/${place.slug}` : null;
  const imageUrl = mainImageUrl(place);

  const location = [place.Stadt, place.Land].filter(Boolean).join(", ");

  const content = (
    <>
      {imageUrl && (
        <div className={styles.image}>
          <Image
            src={imageUrl}
            alt=""
            width={420}
            height={462}
            loading="lazy"
            sizes="(max-width: 700px) 86vw, 420px"
          />
        </div>
      )}

      <span className={styles.gradientTop} aria-hidden="true" />
      <span className={styles.gradientBottom} aria-hidden="true" />

      <div className={styles.bottom}>
        {place.Kategorie.length > 0 && (
          <div className={styles.chipWrap}>
            {place.Kategorie.map((cat) => (
              <CategoryIcon
                key={cat.id}
                categoryId={cat.id}
                color={cat.color || CATEGORY_COLORS[cat.id] || "#666"}
                size={40}
              />
            ))}
          </div>
        )}
        <h3 className={styles.name}>{place.Name}</h3>
        {location && <p className={styles.location}>{location}</p>}
      </div>
    </>
  );

  return href ? (
    <Link href={href} className={styles.card}>
      {content}
    </Link>
  ) : (
    // Ohne slug oder Stadt gibt es keine Detailseite — die Karte bleibt
    // sichtbar, nur ohne Verweis.
    <div className={styles.card}>{content}</div>
  );
}
