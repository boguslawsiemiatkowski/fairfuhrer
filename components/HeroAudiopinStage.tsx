"use client";

// components/HeroAudiopinStage.tsx
//
// Die linke Hälfte des Heros: ein Audiopin, den man sofort anhören kann,
// anstelle des rein dekorativen Bildes, das vorher dort stand.
//
// Aufbau von hinten nach vorn:
//   1. das Titelbild des Ortes, bildschirmfüllend,
//   2. darüber die Farbe seiner Kategorie mit Transparenz — sie bindet die
//      Fläche an das Farbsystem der Karte und macht die weiße Schrift auf
//      jedem Foto lesbar,
//   3. darauf Kategorie-Plakette, Name, Ort, der Abspieler und der Verweis
//      auf das Panel desselben Pins auf der Karte.
//
// Diese Datei trägt "use client".
//
// Nicht aus Bequemlichkeit: ohne die Zeile rendert zwar alles im HTML, aber
// der eingebettete ColumnAudioPlayer bekommt seinen JavaScript-Teil nie
// ausgeliefert — nachgemessen, der Chunk mit dem Abspieler stand in keinem
// <script> der Startseite, und die Längenanzeige blieb bei „0:00“, obwohl
// das <audio>-Element 104 Sekunden kannte.
//
// Für die Suche ist das unerheblich: die Seite bleibt statisch (`○` im
// Build mit revalidate 1h), Name, Ort und Verweis stehen weiterhin im
// ausgelieferten HTML. Nur die Steuerung des Abspielers braucht den
// Browser — und die ist ohne ihn ohnehin sinnlos.
//
// Der Pin wird in Directus ausgewählt (`home_page_content.hero_audiopin`).
// Wer hier nichts hinterlegt oder einen Pin ohne Audio wählt, bekommt kein
// kaputtes Hero: die Seite fällt auf das statische Bild zurück, siehe
// `app/page.tsx`.
import Image from "next/image";
import Link from "next/link";
import ColumnAudioPlayer from "./ColumnAudioPlayer";
import CategoryIcon, { categoryColorFor } from "./CategoryIcon";
import type { HeroAudiopin } from "@/types/cms";
import styles from "./HeroAudiopinStage.module.css";

interface HeroAudiopinStageProps {
  pin: HeroAudiopin;
  /** Fertige Adresse der Audiodatei (siehe `audioUrlFor`). */
  audioSrc: string;
  /** Zahl der veröffentlichten Pins; fehlt sie, bleibt die Zeile weg. */
  placesCount: number | null;
  /** Öffentliche Directus-Adresse für Bild-URLs. */
  directusUrl: string;
}

export default function HeroAudiopinStage({
  pin,
  audioSrc,
  placesCount,
  directusUrl,
}: HeroAudiopinStageProps) {
  const category = pin.Kategorie?.[0]?.Kategorie_id ?? null;

  // categoryColorFor dunkelt die Farbe aus Directus um die Hälfte ab. Das ist
  // hier erwünscht: die hellen Originale (Gelb #E0D12E, Grün #42D742) tragen
  // weiße Schrift nicht, siehe die Messungen in CategoryIcon.tsx.
  const overlayColor = categoryColorFor(
    category ? { id: category.id, color: category.Farbe ?? undefined } : null,
  );

  const image = pin.Titelbild;
  const imageUrl = image?.id
    ? `${directusUrl}/assets/${image.id}` +
      (image.modified_on ? `?v=${Date.parse(image.modified_on)}` : "")
    : null;

  // Dieselbe Adresse, die auch die Audiopin-Seiten verwenden: das Panel des
  // Pins öffnet sich direkt auf der Karte.
  const mapHref = `/karte?pin=${encodeURIComponent(pin.slug || String(pin.id))}`;

  const location = [pin.Stadt, pin.Land].filter(Boolean).join(", ");

  return (
    <div className={styles.stage}>
      {imageUrl && (
        <Image
          src={imageUrl}
          alt=""
          fill
          priority
          sizes="(max-width: 900px) 100vw, 50vw"
          className={styles.image}
        />
      )}

      {/* Die Farbfläche liegt über dem Bild und trägt den gesamten Text. */}
      <div
        className={styles.overlay}
        style={{ backgroundColor: overlayColor }}
        aria-hidden="true"
      />
      {/* Zusätzliche Abdunklung oben und unten, wo der Text am größten ist
          und Fotos am häufigsten hell sind. */}
      <div className={styles.scrim} aria-hidden="true" />

      <div className={styles.content}>
        {category && (
          <p className={styles.categoryRow}>
            <CategoryIcon
              categoryId={category.id}
              color="rgba(255, 255, 255, 0.22)"
              size={30}
              className={styles.categoryIcon}
            />
            <span className={styles.categoryName}>{category.Name}</span>
          </p>
        )}

        <h2 className={styles.name}>{pin.Name}</h2>
        {location && <p className={styles.location}>{location}</p>}

        <div className={styles.playerWrap}>
          <ColumnAudioPlayer src={audioSrc} title={pin.Name ?? "Audiopin"} />
        </div>

        <Link href={mapHref} className={styles.mapLink}>
          <span>Auf der Karte ansehen</span>
          <span aria-hidden="true">→</span>
        </Link>

        {placesCount !== null && (
          <p className={styles.count}>
            <strong>{placesCount}</strong> faire Orte zum Entdecken
          </p>
        )}
      </div>
    </div>
  );
}
