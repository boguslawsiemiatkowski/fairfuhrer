// components/CategoryIcon.tsx
//
// Genaue Entsprechung von components/CategoryIcon.tsx der App: ein Kreis in
// der Kategoriefarbe, darin das Lucide-Symbol in Weiß, auf 60 % skaliert und
// mittig gesetzt. Die Pfade liegen schon in lib/categoryIcons.ts.
import { CATEGORY_ICON_PATHS, DEFAULT_ICON_PATHS } from "@/lib/categoryIcons";

/** Fallback-Farben wie in der App, falls Directus keine Farbe liefert. */
export const CATEGORY_COLORS: Record<number, string> = {
  1: "#E45858", // Sehenswertes
  2: "#6477E3", // Essen & Übernachten
  3: "#F0873D", // Einkaufen
  5: "#42D742", // Engagement
  8: "#9B59B6", // Unternehmen & Handwerk
};

/** Symbol für „Alle Kategorien“ — Globus, wie in der App. */
const ALL_ICON_PATHS =
  '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20"/>' +
  '<path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>' +
  '<path d="M2 12h20"/>';

interface CategoryIconProps {
  /** null = „Alle Kategorien“. */
  categoryId: number | null;
  /** Füllfarbe des Kreises. */
  color: string;
  /** Strichfarbe des Symbols; in der App standardmäßig weiß. */
  strokeColor?: string;
  size?: number;
  className?: string;
}

export default function CategoryIcon({
  categoryId,
  color,
  strokeColor = "#fff",
  size = 36,
  className,
}: CategoryIconProps) {
  const paths =
    categoryId !== null
      ? (CATEGORY_ICON_PATHS[categoryId] ?? DEFAULT_ICON_PATHS)
      : ALL_ICON_PATHS;

  // Wie in der App: Symbol auf 60 % skaliert und um den halben Rest versetzt,
  // damit es im Kreis zentriert bleibt.
  const scale = 0.6;
  const offset = 12 * (1 - scale);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="11" fill={color} />
      <g
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={`translate(${offset}, ${offset}) scale(${scale})`}
        // Die Pfade sind feste Zeichenketten aus lib/categoryIcons.ts,
        // keine Nutzereingabe.
        dangerouslySetInnerHTML={{ __html: paths }}
      />
    </svg>
  );
}
