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

/** Reiner Text aus bereinigtem HTML — für <meta description> und Teaser. */
export function htmlToPlainText(html: string | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|li|ul|ol)>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
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
