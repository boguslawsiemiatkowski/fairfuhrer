// app/partner-werden/page.tsx
// Mitmachen-Seite (Layout wie Homepage: Bild links, Orange-Box rechts + 3 Buttons).
// Drei detaillierte Sektionen darunter (Reisende, Partner, Redaktion).
// Voraussetzungen + Pin-Vergleich + Preise wurden auf die Unterseite
// /partner-werden/voraussetzungen verschoben.

import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import { marked } from "marked";
import { getPartnerPageContent } from "@/lib/directus";
import styles from "./partner-werden.module.css";

const directusUrl = process.env.NEXT_PUBLIC_DIRECTUS_URL!;

export const revalidate = 0; // bez ISR — strona renderuje się dynamicznie (Flow nie rewaliduje tagu)

export const metadata: Metadata = {
  title: "Mitmachen",
  description:
    "Mitmachen beim Fairführer — als Reisende*r, als Partner*in oder in der Redaktion.",
};

export default async function MitmachenPage() {
  const pageData = await getPartnerPageContent({ noStore: true });

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

  // Markdown -> HTML (Tashina's Sektionstexte + Hero-Intro)
  const heroIntroHtml = pageData.mitmachen_hero_intro
    ? await marked(pageData.mitmachen_hero_intro)
    : "";
  const reisendeHtml = pageData.mitmachen_reisende_section_text
    ? await marked(pageData.mitmachen_reisende_section_text)
    : "";
  const partnerHtml = pageData.mitmachen_partner_section_text
    ? await marked(pageData.mitmachen_partner_section_text)
    : "";
  const redaktionHtml = pageData.mitmachen_redaktion_section_text
    ? await marked(pageData.mitmachen_redaktion_section_text)
    : "";

  const heroImageSrc = pageData.mitmachen_hero_image
    ? `${directusUrl}/assets/${pageData.mitmachen_hero_image}`
    : null;

  // Znormalizuj kolor: dopisz # jesli brakuje (Directus czasem trzyma bez #)
  const c = (val?: string) =>
    val ? (val.startsWith("#") ? val : `#${val}`) : undefined;

  // Kolory pojedynczego przycisku CTA (tło + tło na hover) jako zmienne CSS.
  // Każdy z 3 przycisków sekcji ma własne, niezależne kolory z Directusa.
  const ctaStyle = (color?: string, hover?: string) =>
    ({
      ...(c(color) && { "--cta-bg": c(color) }),
      ...(c(hover) && { "--cta-bg-hover": c(hover) }),
    }) as React.CSSProperties;

  // CSS variables — analogicznie do homepage (app/page.tsx)
  const cssVars = {
    ...(c(pageData.link_color) && {
      "--pp-link": c(pageData.link_color),
    }),
    ...(pageData.mitmachen_hero_background_color && {
      "--mm-hero-bg": c(pageData.mitmachen_hero_background_color),
    }),
    ...(pageData.mitmachen_hero_headline_font_size && {
      "--mm-fs-headline": pageData.mitmachen_hero_headline_font_size,
    }),
    ...(pageData.mitmachen_hero_headline_color && {
      "--mm-color-headline": c(pageData.mitmachen_hero_headline_color),
    }),
    ...(pageData.mitmachen_hero_headline_mobile_font_size && {
      "--mm-fs-headline-mobile": pageData.mitmachen_hero_headline_mobile_font_size,
    }),
    ...(pageData.mitmachen_hero_headline_mobile_color && {
      "--mm-color-headline-mobile": c(pageData.mitmachen_hero_headline_mobile_color),
    }),
    ...(pageData.mitmachen_hero_intro_font_size && {
      "--mm-fs-intro": pageData.mitmachen_hero_intro_font_size,
    }),
    ...(pageData.mitmachen_hero_intro_color && {
      "--mm-color-intro": c(pageData.mitmachen_hero_intro_color),
    }),
    ...(pageData.mitmachen_hero_text_color && {
      "--mm-color-hero-text": c(pageData.mitmachen_hero_text_color),
    }),
    ...(pageData.mitmachen_hero_button_font_size && {
      "--mm-fs-btn": pageData.mitmachen_hero_button_font_size,
    }),
    ...(pageData.mitmachen_hero_button_color && {
      "--mm-color-btn": c(pageData.mitmachen_hero_button_color),
    }),
    ...(pageData.mitmachen_hero_button_background_color && {
      "--mm-bg-btn": c(pageData.mitmachen_hero_button_background_color),
    }),
    ...(pageData.mitmachen_hero_button_background_color_hover && {
      "--mm-bg-btn-hover": c(pageData.mitmachen_hero_button_background_color_hover),
    }),
    ...(pageData.mitmachen_hero_button_mobile_font_size && {
      "--mm-fs-btn-mobile": pageData.mitmachen_hero_button_mobile_font_size,
    }),
    ...(pageData.mitmachen_hero_button_mobile_color && {
      "--mm-color-btn-mobile": c(pageData.mitmachen_hero_button_mobile_color),
    }),
    ...(pageData.mitmachen_hero_button_background_color_mobile && {
      "--mm-bg-btn-mobile": c(pageData.mitmachen_hero_button_background_color_mobile),
    }),
  } as React.CSSProperties;

  return (
    <main className={styles.main} style={cssVars}>
      {/* HERO — Layout wie Homepage: Bild links, Orange-Box rechts mit 3 Buttons */}
      <section className={styles.heroContainer}>
        <div className={styles.heroImageSide}>
          {heroImageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroImageSrc}
              alt="Mitmachen"
              className={styles.heroImage}
            />
          ) : (
            <div className={styles.heroImagePlaceholder}>
              <p>Bild fehlt — bitte im Directus hochladen.</p>
            </div>
          )}
        </div>

        <div className={styles.heroTextSide}>
          {pageData.mitmachen_hero_headline && (
            <h1 className={styles.heroHeadline}>
              {pageData.mitmachen_hero_headline}
            </h1>
          )}
          {heroIntroHtml && (
            <div
              className={styles.heroIntro}
              dangerouslySetInnerHTML={{ __html: heroIntroHtml }}
            />
          )}

          {/* 3 buttons — springen nur zur passenden Sektion auf DIESER Seite
              (Anker #reisende / #partner / #redaktion), nicht auf andere Seiten. */}
          <div className={styles.heroButtons}>
            {pageData.mitmachen_button_1_label && (
              <Link href="#reisende" className={styles.heroButton}>
                {pageData.mitmachen_button_1_label}
              </Link>
            )}
            {pageData.mitmachen_button_2_label && (
              <Link href="#partner" className={styles.heroButton}>
                {pageData.mitmachen_button_2_label}
              </Link>
            )}
            {pageData.mitmachen_button_3_label && (
              <Link href="#redaktion" className={styles.heroButton}>
                {pageData.mitmachen_button_3_label}
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* SEKTION REISENDE */}
      {(pageData.mitmachen_reisende_section_title || reisendeHtml) && (
        <section
          className={styles.sectionRole}
          id="reisende"
          style={{
            backgroundColor:
              c(pageData.mitmachen_reisende_background_color) || "#ffffff",
          }}
        >
          <div className={styles.sectionInner}>
            {pageData.mitmachen_reisende_section_title && (
              <h2
                className={styles.sectionTitle}
                style={{
                  color: c(pageData.mitmachen_reisende_title_color) || "#fc6c14",
                }}
              >
                {pageData.mitmachen_reisende_section_title}
              </h2>
            )}
            {reisendeHtml && (
              <div
                className={styles.sectionText}
                dangerouslySetInnerHTML={{ __html: reisendeHtml }}
              />
            )}
            {pageData.mitmachen_reisende_button_label &&
              pageData.mitmachen_button_1_url && (
                <Link
                  href={pageData.mitmachen_button_1_url}
                  className={styles.sectionCta}
                  style={ctaStyle(
                    pageData.mitmachen_reisende_button_color,
                    pageData.mitmachen_reisende_button_hover_color,
                  )}
                >
                  {pageData.mitmachen_reisende_button_label}
                </Link>
              )}
          </div>
        </section>
      )}

      {/* SEKTION PARTNER */}
      {(pageData.mitmachen_partner_section_title || partnerHtml) && (
        <section
          className={`${styles.sectionRole} ${styles.sectionRoleAlt}`}
          id="partner"
          style={{
            backgroundColor:
              c(pageData.mitmachen_partner_background_color) || "#f7f4f0",
          }}
        >
          <div className={styles.sectionInner}>
            {pageData.mitmachen_partner_section_title && (
              <h2
                className={styles.sectionTitle}
                style={{
                  color: c(pageData.mitmachen_partner_title_color) || "#fc6c14",
                }}
              >
                {pageData.mitmachen_partner_section_title}
              </h2>
            )}
            {partnerHtml && (
              <div
                className={styles.sectionText}
                dangerouslySetInnerHTML={{ __html: partnerHtml }}
              />
            )}
            {pageData.mitmachen_partner_button_label &&
              pageData.mitmachen_button_2_url && (
                <Link
                  href={pageData.mitmachen_button_2_url}
                  className={styles.sectionCta}
                  style={ctaStyle(
                    pageData.mitmachen_partner_button_color,
                    pageData.mitmachen_partner_button_hover_color,
                  )}
                >
                  {pageData.mitmachen_partner_button_label}
                </Link>
              )}
          </div>
        </section>
      )}

      {/* SEKTION REDAKTION */}
      {(pageData.mitmachen_redaktion_section_title || redaktionHtml) && (
        <section
          className={styles.sectionRole}
          id="redaktion"
          style={{
            backgroundColor:
              c(pageData.mitmachen_redaktion_background_color) || "#ffffff",
          }}
        >
          <div className={styles.sectionInner}>
            {pageData.mitmachen_redaktion_section_title && (
              <h2
                className={styles.sectionTitle}
                style={{
                  color:
                    c(pageData.mitmachen_redaktion_title_color) || "#fc6c14",
                }}
              >
                {pageData.mitmachen_redaktion_section_title}
              </h2>
            )}
            {redaktionHtml && (
              <div
                className={styles.sectionText}
                dangerouslySetInnerHTML={{ __html: redaktionHtml }}
              />
            )}
            {pageData.mitmachen_redaktion_button_label &&
              pageData.mitmachen_button_3_url && (
                <Link
                  href={pageData.mitmachen_button_3_url}
                  className={styles.sectionCta}
                  style={ctaStyle(
                    pageData.mitmachen_redaktion_button_color,
                    pageData.mitmachen_redaktion_button_hover_color,
                  )}
                >
                  {pageData.mitmachen_redaktion_button_label}
                </Link>
              )}
          </div>
        </section>
      )}
    </main>
  );
}
