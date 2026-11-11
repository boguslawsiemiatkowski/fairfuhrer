// components/CategoryCards.tsx
//
// Die fünf Kategorien auf der Startseite, als Karten statt als bloße Reihe
// von Kreisen.
//
// Vorher standen dort Symbol und Name — hübsch, aber ohne Auskunft und ohne
// Ziel. Jetzt trägt jede Karte zusätzlich den Beschreibungstext aus Directus,
// die Zahl ihrer Orte und führt auf die gefilterte Liste. Damit wird aus der
// Dekoration ein Einstieg.
//
// Serverkomponente: es gibt nichts anzuklicken außer Verweisen, also braucht
// der Abschnitt kein JavaScript im Browser. Der Text steht vollständig im
// HTML und ist damit auch für die Suche lesbar.
import Link from "next/link";
import type { Category } from "@/types";
import { cityToSegment, htmlToPlainText } from "@/lib/orte-shared";
import { getCategoryIconPaths, DEFAULT_ICON_PATHS } from "@/lib/categoryIcons";
import { categoryColorFor } from "./CategoryIcon";
import styles from "./CategoryCards.module.css";

interface CategoryCardsProps {
  categories: Category[];
  /** Zahl der Orte je Kategorie-ID; fehlt ein Eintrag, bleibt die Zeile leer. */
  counts: Record<number, number>;
}

export default function CategoryCards({
  categories,
  counts,
}: CategoryCardsProps) {
  return (
    <div className={styles.grid}>
      {categories.map((cat) => {
        const iconPaths = getCategoryIconPaths(cat.id) ?? DEFAULT_ICON_PATHS;
        const color = categoryColorFor(cat);

        // Die Beschreibungen liegen als HTML in Directus (`<p>…</p>`, mit
        // Entitäten wie &uuml;). Hier wird nur der Text gebraucht — und
        // htmlToPlainText räumt beides weg, statt das HTML einzusetzen.
        const text = htmlToPlainText(cat.description).trim();

        // Die Liste filtert über den Namen, nicht über die ID
        // (siehe app/liste/OrteListe.tsx: `cityToSegment(cat.name)`).
        const href = `/liste?kategorie=${encodeURIComponent(cityToSegment(cat.name))}`;

        const count = counts[cat.id];

        return (
          <Link
            key={cat.id}
            href={href}
            className={styles.card}
            // Die Karte trägt die Farbe ihrer Kategorie. Sie ist bereits um
            // die Hälfte abgedunkelt (categoryColorFor), sonst würde die
            // weiße Schrift darauf nicht die nötigen 4,5:1 erreichen —
            // Gelb und Grün im Original sind dafür viel zu hell.
            style={{ backgroundColor: color }}
          >
            <span className={styles.iconRing} aria-hidden="true">
              <svg width={42} height={42} viewBox="0 0 24 24" focusable="false">
                <g
                  fill="none"
                  stroke={color}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  // Feste Zeichenketten aus lib/categoryIcons.ts, nach `id`
                  // ausgewählt — keine Directus-Inhalte.
                  dangerouslySetInnerHTML={{ __html: iconPaths }}
                />
              </svg>
            </span>

            <h3 className={styles.name}>{cat.name}</h3>

            {text && <p className={styles.text}>{text}</p>}

            <span className={styles.footer}>
              {typeof count === "number" && (
                <span className={styles.count}>
                  <strong>{count}</strong> {count === 1 ? "Ort" : "Orte"}
                </span>
              )}
              <span className={styles.arrow} aria-hidden="true">
                →
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
