// app/partner-werden/voraussetzungen/page.tsx
// Unterseite: Voraussetzungen für eine Partnerschaft + Standard vs Partner Pin + Preise.
// Holt Daten aus derselben Kolekcja `partner_page_content` (felder voraussetzungen_*,
// pin_vergleich_*, kosten_*, cta_button_*).

import { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { marked } from "marked";
import { getPartnerPageContent } from "@/lib/directus";
import styles from "./voraussetzungen.module.css";

export const revalidate = 604800;

export const metadata: Metadata = {
  title: "Voraussetzungen für eine Partnerschaft",
  description:
    "Voraussetzungen, Pin-Optionen und Preise für eine Partnerschaft beim Fairführer.",
};

export default async function VoraussetzungenPage() {
  const pageData = await getPartnerPageContent({ revalidate: 604800 });

  if (!pageData) {
    return (
      <div className={styles.container}>
        <div className={styles.errorMessage}>
          <h1>Seite nicht gefunden</h1>
          <p>Die angeforderte Seite konnte nicht geladen werden.</p>
        </div>
      </div>
    );
  }

  // Alle Rich-Text-Felder dieser Kolekcja sind Markdown-Felder (input-rich-text-md)
  // in Directus. Sie müssen daher vor dem Rendern nach HTML konvertiert werden.
  // Externe Links (http/https) öffnen wir in einem neuen Tab.
  const externalizeLinks = (html: string) =>
    html.replace(
      /<a\s+href="(https?:\/\/[^"]+)"/gi,
      '<a href="$1" target="_blank" rel="noopener noreferrer"',
    );
  const toHtml = async (md?: string) =>
    md ? externalizeLinks(await marked(md)) : null;
  const [
    voraussetzungenHtml,
    pinStandardHtml,
    pinPartnerHtml,
    kostenIntroHtml,
    ...kostenTiersHtml
  ] = await Promise.all([
    toHtml(pageData.voraussetzungen_text),
    toHtml(pageData.pin_vergleich_standard_text),
    toHtml(pageData.pin_vergleich_partner_text),
    toHtml(pageData.kosten_intro),
    toHtml(pageData.kosten_tier_1),
    toHtml(pageData.kosten_tier_2),
    toHtml(pageData.kosten_tier_3),
    toHtml(pageData.kosten_tier_4),
  ]);

  // Normalizuj kolor: dopisz # jeśli brakuje (Directus czasem trzyma bez #)
  const norm = (v?: string) =>
    v ? (v.startsWith("#") ? v : `#${v}`) : undefined;

  // Globalna kolekcyjna kolor linków
  const linkColor = norm(pageData.link_color);
  // Kolory tytułów (H2) kart porównania pinów
  const pinStandardTitleColor = norm(pageData.pin_vergleich_standard_title_color);
  const pinPartnerTitleColor = norm(pageData.pin_vergleich_partner_title_color);

  return (
    <main
      className={styles.main}
      style={linkColor ? ({ "--pp-link": linkColor } as CSSProperties) : undefined}
    >
      {/* SEKCJA 1 — Voraussetzungen (dwukolumnowy: 40% tytuł | 60% tekst) */}
      {(pageData.voraussetzungen_title || pageData.voraussetzungen_text) && (
        <section className={styles.voraussetzungen}>
          <div
            className={styles.voraussetzungenLinks}
            style={{
              backgroundColor:
                pageData.voraussetzungen_left_background || "#000000",
            }}
          >
            {pageData.voraussetzungen_title && (
              <h2
                className={styles.voraussetzungenTitle}
                style={{
                  color: pageData.voraussetzungen_title_color || "#FFFFFF",
                }}
              >
                {pageData.voraussetzungen_title}
              </h2>
            )}
          </div>
          <div
            className={styles.voraussetzungenRechts}
            style={{
              backgroundColor:
                pageData.voraussetzungen_right_background || "#FFFFFF",
            }}
          >
            {voraussetzungenHtml && (
              <div
                className={styles.voraussetzungenText}
                style={{
                  color: pageData.voraussetzungen_text_color || "#000000",
                }}
                dangerouslySetInnerHTML={{
                  __html: voraussetzungenHtml,
                }}
              />
            )}
          </div>
        </section>
      )}

      {/* SEKCJA 2 — Pin-Vergleich (Standard vs Partner Pin) */}
      {(pageData.pin_vergleich_standard_text ||
        pageData.pin_vergleich_partner_text) && (
        <section
          className={styles.pinVergleich}
          style={{
            backgroundColor: pageData.pin_vergleich_background || "#FC6C14",
          }}
        >
          <div className={styles.pinVergleichKarteLinks}>
            {pinStandardHtml && (
              <div
                className={styles.pinVergleichText}
                style={
                  pinStandardTitleColor
                    ? ({ "--pin-title": pinStandardTitleColor } as CSSProperties)
                    : undefined
                }
                dangerouslySetInnerHTML={{
                  __html: pinStandardHtml,
                }}
              />
            )}
          </div>
          <div className={styles.pinVergleichKarteRechts}>
            {pinPartnerHtml && (
              <div
                className={styles.pinVergleichText}
                style={
                  pinPartnerTitleColor
                    ? ({ "--pin-title": pinPartnerTitleColor } as CSSProperties)
                    : undefined
                }
                dangerouslySetInnerHTML={{
                  __html: pinPartnerHtml,
                }}
              />
            )}
          </div>
        </section>
      )}

      {/* SEKCJA 3 — Kosten (tytuł + intro + 4 karty cen) */}
      {(pageData.kosten_title ||
        pageData.kosten_intro ||
        pageData.kosten_tier_1 ||
        pageData.kosten_tier_2 ||
        pageData.kosten_tier_3 ||
        pageData.kosten_tier_4) && (
        <section
          className={styles.kosten}
          style={{
            backgroundColor: pageData.kosten_background || "#000000",
            color: pageData.kosten_text_color || "#FFFFFF",
          }}
        >
          {pageData.kosten_title && (
            <h2
              className={styles.kostenTitle}
              style={{ color: pageData.kosten_title_color || "#FFFFFF" }}
            >
              {pageData.kosten_title}
            </h2>
          )}
          {kostenIntroHtml && (
            <div
              className={styles.kostenIntro}
              dangerouslySetInnerHTML={{ __html: kostenIntroHtml }}
            />
          )}
          {kostenTiersHtml.some(Boolean) && (
            <div className={styles.kostenKarten}>
              {kostenTiersHtml.map(
                (karte, i) =>
                  karte && (
                    <div
                      key={i}
                      className={styles.kostenKarte}
                      dangerouslySetInnerHTML={{ __html: karte }}
                    />
                  ),
              )}
            </div>
          )}
          {pageData.cta_button_label && pageData.cta_button_url && (
            <div className={styles.ctaRow}>
              <Link
                href={pageData.cta_button_url}
                className={styles.ctaButton}
                style={
                  {
                    color: pageData.cta_button_color || "#FFFFFF",
                    ...(pageData.cta_button_background_color && {
                      "--cta-bg": pageData.cta_button_background_color,
                    }),
                    ...(pageData.cta_button_hover_color && {
                      "--cta-bg-hover": pageData.cta_button_hover_color,
                    }),
                  } as CSSProperties
                }
              >
                {pageData.cta_button_label}
              </Link>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
