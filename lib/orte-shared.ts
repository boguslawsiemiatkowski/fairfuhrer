// lib/orte-shared.ts
// Reine Hilfsfunktionen rund um Orte — OHNE `server-only`, damit auch Client
// Components sie nutzen können (z. B. die Filter auf /liste).
//
// lib/orte.ts (serverseitig) re-exportiert sie, damit es für Server-Code nur
// eine Importstelle gibt.

/**
 * Erzeugt aus einem Namen das URL-Segment. MUSS mit der Normalisierung
 * übereinstimmen, mit der die slugs in Directus gefüllt wurden — sonst findet
 * die Route den Eintrag nicht wieder.
 *
 * Reihenfolge ist wichtig: Umlaute VOR der Unicode-Normalisierung, sonst wird
 * aus "ü" ein "u" statt "ue". Unsichtbare Zeichen (weiches Trennzeichen,
 * Zero-Width-Space) stecken in echten Namen wie "Kunst­museum Lände".
 */
export function cityToSegment(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/[­​-‍﻿]/g, "")
    .replace(/ /g, " ")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[‘’‚‛“”„‟'"`´]/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "-und-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Entfernung zweier Punkte in Metern (äquirektangulare Näherung).
 *
 * Für den Bodensee und das Allgäu genau genug: auf 50 km weicht sie um
 * weniger als 0,1 % von der Großkreisentfernung ab. Dieselbe Formel sortiert
 * auf /liste nach Entfernung, dort allerdings ohne Wurzel, weil zum
 * Sortieren das Quadrat genügt.
 */
export function distanceInMeters(
  [lonA, latA]: [number, number],
  [lonB, latB]: [number, number],
): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (latB - latA) * rad;
  const dLon = (lonB - lonA) * rad * Math.cos(((latA + latB) / 2) * rad);
  return Math.round(R * Math.hypot(dLat, dLon));
}

/** „1,2 km" bzw. „450 m" — deutsche Schreibweise mit Komma. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  const km = meters / 1000;
  return `${km.toFixed(1).replace(".", ",")} km`;
}

/** Innerer Radius: darunter liegt der Pin praktisch am selben Ort. */
const DISCOVERY_MIN_M = 400;
/** Äußerer Radius: darüber ist es kein Abstecher mehr. */
const DISCOVERY_MAX_M = 12000;

type DiscoveryCandidate = {
  slug?: string;
  Stadt?: string;
  location: { coordinates: [number, number] };
};

/**
 * Wählt zu einem Ort eine „Entdeckung in der Nähe" — einen anderen Pin im
 * Ring von 400 m bis 12 km.
 *
 * NICHT den nächstgelegenen: der ist fast immer gegenseitig. Von 591 Pins
 * bilden 346 ein Paar (A→B→A), und 239 haben ihren nächsten Nachbarn näher
 * als 100 m, einer sogar bei 0 m. Wer klickt, würde zwischen zwei Häusern
 * derselben Gasse hin- und herspringen.
 *
 * Stattdessen entscheidet der eigene Name des Ortes, welcher Kandidat es
 * wird. Das ist kein Zufall im Wortsinn: dieselbe Seite zeigt immer dasselbe
 * Ziel, deshalb lässt sie sich vorrendern und Google sieht denselben Link
 * wie ein Mensch. Bei durchschnittlich 55 Kandidaten je Pin ist ein
 * gegenseitiges Paar praktisch ausgeschlossen — der Weg führt weiter, statt
 * zu pendeln.
 *
 * Kandidaten in einer anderen Gemeinde gehen vor: eine Entdeckung im
 * Nachbardorf ist interessanter als das nächste Haus in Lindau. Für 581 der
 * 591 Pins gibt es so einen Kandidaten.
 */
export function pickDiscovery<T extends DiscoveryCandidate>(
  current: { slug?: string; Stadt?: string; location: { coordinates: [number, number] } },
  all: T[],
): { place: T; meters: number } | null {
  const origin = current.location.coordinates;

  const inRing: { place: T; meters: number }[] = [];
  for (const place of all) {
    if (!place.slug || place.slug === current.slug) continue;
    const meters = distanceInMeters(origin, place.location.coordinates);
    if (meters < DISCOVERY_MIN_M || meters > DISCOVERY_MAX_M) continue;
    inRing.push({ place, meters });
  }
  if (inRing.length === 0) return null;

  // Stabile Reihenfolge, damit die Wahl nicht von der Sortierung der
  // Directus-Antwort abhängt — sonst könnte derselbe Ort nach einer
  // Datenänderung auf ein anderes Ziel zeigen. Orte in einer anderen
  // Gemeinde stehen vorn.
  //
  // Wichtig: sie werden NUR vorgezogen, nicht ausgewählt. Ein erster
  // Versuch hatte die Auswahl auf sie beschränkt — bei den 10 Pins mit
  // genau einem solchen Kandidaten blieb dann ein einziger übrig, und
  // Seeg und Füssen zeigten gegenseitig aufeinander.
  const pool = [...inRing].sort((a, b) => {
    const aOther = a.place.Stadt !== current.Stadt ? 0 : 1;
    const bOther = b.place.Stadt !== current.Stadt ? 0 : 1;
    if (aOther !== bOther) return aOther - bOther;
    return (a.place.slug ?? "").localeCompare(b.place.slug ?? "");
  });

  // Quersumme der Zeichen des eigenen slug als Index.
  const seed = [...(current.slug ?? "")].reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  );
  const start = seed % pool.length;

  // Ein Ziel, das von sich aus zurückzeigen würde, wird übersprungen —
  // sonst pendelt der Weg zwischen zwei Seiten. Geprüft wird, indem für den
  // Kandidaten dieselbe Rechnung durchgespielt wird.
  //
  // Höchstens ein paar Versuche: jeder kostet einen Durchlauf über alle
  // Orte, und beim Build geschieht das für 590 Seiten. Zeigen die ersten
  // Kandidaten alle zurück, ist der Pin so abgelegen, dass ein Pendel
  // ohnehin kaum zu vermeiden ist.
  const tries = Math.min(pool.length, 4);
  for (let step = 0; step < tries; step++) {
    const candidate = pool[(start + step) % pool.length];
    if (!pointsBackTo(candidate.place, current, all)) return candidate;
  }

  // Keiner der geprüften Kandidaten war frei von Rückverweis: dann ist ein
  // Pendel hinzunehmen, ein Link bleibt besser als keiner.
  return pool[start];
}

/**
 * Würde `candidate` seinerseits auf `origin` zeigen? Spielt dieselbe
 * Auswahl für den Kandidaten durch — ohne die Rückwärtsprüfung, sonst
 * liefen die beiden Aufrufe im Kreis.
 */
function pointsBackTo(
  candidate: DiscoveryCandidate,
  origin: { slug?: string },
  all: DiscoveryCandidate[],
): boolean {
  const from = candidate.location.coordinates;
  const ring: DiscoveryCandidate[] = [];
  for (const place of all) {
    if (!place.slug || place.slug === candidate.slug) continue;
    const meters = distanceInMeters(from, place.location.coordinates);
    if (meters < DISCOVERY_MIN_M || meters > DISCOVERY_MAX_M) continue;
    ring.push(place);
  }
  if (ring.length === 0) return false;

  ring.sort((a, b) => {
    const aOther = a.Stadt !== candidate.Stadt ? 0 : 1;
    const bOther = b.Stadt !== candidate.Stadt ? 0 : 1;
    if (aOther !== bOther) return aOther - bOther;
    return (a.slug ?? "").localeCompare(b.slug ?? "");
  });

  const seed = [...(candidate.slug ?? "")].reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  );
  return ring[seed % ring.length].slug === origin.slug;
}

/**
 * Räumt HTML auf, das aus Word, Teams oder einem anderen WYSIWYG-Editor
 * eingefügt wurde. Erlaubt nur eine strikte Whitelist an Tags, entfernt alle
 * Attribute (außer sicheren href-Links bei <a>), Word-Kommentare, &nbsp;-Ketten
 * und leere Elemente.
 */
export function sanitizeWordHtml(html: string): string {
  return html
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(?!\/?(?:p|br|strong|b|em|i|a|ul|ol|li)(?:\s|\/?>))[^>]+>/gi, "")
    .replace(/<(p|br|strong|b|em|i|ul|ol|li)\b[^>]*>/gi, "<$1>")
    .replace(/<a\b[^>]*>/gi, (match) => {
      const hrefMatch = match.match(/\bhref\s*=\s*["']((?:https?:|mailto:|tel:)[^"']+)["']/i);
      if (!hrefMatch) return "<a>";
      const safeHref = hrefMatch[1].replace(/"/g, "&quot;");
      return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">`;
    })
    .replace(/&nbsp;(\s*&nbsp;)+/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/<(p|li|a)>\s*<\/\1>/gi, "")
    .replace(/(<br\s*\/?>\s*){3,}/gi, "<br><br>")
    .replace(/^\s*(<br\s*\/?>\s*)+/gi, "")
    .trim();
}

/** Reiner Text aus bereinigtem HTML — für <meta description>, JSON-LD und Teaser. */
/**
 * Prüft und normalisiert externe URLs (z. B. `Link_URL`).
 * Erlaubt ausschließlich `http://` und `https://` (ergänzt `https://`, falls
 * kein Schema angegeben wurde, z. B. `www.beispiel.de`) und verwirft
 * unsichere Schemata wie `javascript:` oder `data:`.
 */
export function sanitizeExternalUrl(
  raw: string | null | undefined,
): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const candidate = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }
    return candidate;
  } catch {
    return undefined;
  }
}

export function htmlToPlainText(html: string | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|li|ul|ol|div)>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&auml;/g, "ä")
    .replace(/&ouml;/g, "ö")
    .replace(/&uuml;/g, "ü")
    .replace(/&Auml;/g, "Ä")
    .replace(/&Ouml;/g, "Ö")
    .replace(/&Uuml;/g, "Ü")
    .replace(/&szlig;/gi, "ß")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/&bdquo;/gi, "„")
    .replace(/&ldquo;|&rdquo;/gi, "“")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/\s+/g, " ")
    .trim();
}

/** Kürzt Text an einer Wortgrenze, ohne mitten im Wort abzubrechen. */
export function truncateAtWord(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

// ─── Bilder ─────────────────────────────────────────────────────────────────
//
// Bilder liegen in zwei Formen vor, und fast alle Orte nutzen die ältere:
//
//   neu  — `Titelbild` / `Galerie`: UUIDs auf Dateien in Directus (197 bzw. 63)
//   alt  — `Hauptbild` / `Galerie_Bilder`: Dateinamen in Supabase Storage
//          (574 bzw. 132)
//
// Wer nur die neue Form abfragt, zeigt bei zwei Dritteln der Orte kein Bild.
// Die Karte behandelte das schon immer, die neuen Seiten brauchen es ebenso.

interface PlaceImages {
  Titelbild?: string;
  Hauptbild?: string;
  Galerie?: string[];
  Galerie_Bilder?: string[];
}

function directusAssetUrl(uuid: string): string | null {
  const base = process.env.NEXT_PUBLIC_DIRECTUS_URL;
  return base ? `${base}/assets/${uuid}` : null;
}

function supabasePlaceImageUrl(
  filename: string,
  type: "main" | "gallery",
): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/media-files/places/images/${type}/${filename}`;
}

/** URL des Hauptbildes, egal in welcher Form es vorliegt. */
export function mainImageUrl(place: PlaceImages): string | null {
  if (place.Titelbild) return directusAssetUrl(place.Titelbild);
  if (place.Hauptbild) return supabasePlaceImageUrl(place.Hauptbild, "main");
  return null;
}

/** Alle Galeriebilder als URLs, beide Formen zusammengeführt. */
export function galleryUrls(place: PlaceImages): string[] {
  const fromDirectus = (place.Galerie ?? [])
    .map(directusAssetUrl)
    .filter((u): u is string => u !== null);

  // Das erste Galerie_Bilder-Element ist bei vielen Orten dasselbe Foto wie
  // Hauptbild; es bleibt drin, damit die Galerie der auf der Karte entspricht.
  const fromSupabase = (place.Galerie_Bilder ?? [])
    .map((name) => supabasePlaceImageUrl(name, "gallery"))
    .filter((u): u is string => u !== null);

  return [...fromDirectus, ...fromSupabase];
}

/** Vergleichsform für die Suche: Umlaute vereinfacht, Kleinschreibung. */
export function normalizeForSearch(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss")
    .trim();
}
