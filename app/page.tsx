import React from "react";
import Image from "next/image";
import Link from "next/link";
import { marked } from "marked";
import { getCategoryIconPaths, DEFAULT_ICON_PATHS } from "@/lib/categoryIcons";
import heroImage from "@/public/fair-fuehrer-guide-hero.jpg";
import appStoreBadge from "@/public/app-store-badge.svg";
import googlePlayBadge from "@/public/android-store-badge.svg";
import seenergienLogo from "@/public/seenergienlogo.png";
import MuxVideoEmbed from "@/components/MuxVideoEmbed";
import { ConditionalMuxVideo } from "@/components/ConditionalMuxVideo";
import styles from "./page.module.css";
import { getHomePageContent } from "@/lib/directus";
import { categoryColorFor } from "@/components/CategoryIcon";

const APP_STORE_URL =
  "https://apps.apple.com/de/app/fairf%C3%BChrer/id6778095803";
const GOOGLE_PLAY_URL =
  "https://play.google.com/store/apps/details?id=com.fairfuehrer.app";

// Dieselben zwei Links erscheinen in der Hero-Leiste (Desktop) und im
// eigenen Abschnitt darunter (Mobil) - deshalb einmal definiert.
function StoreBadgeLinks({
  iconsClassName,
  imgClassName,
}: {
  iconsClassName: string;
  imgClassName: string;
}) {
  return (
    <div className={iconsClassName}>
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Fairführer im App Store öffnen"
      >
        <Image
          src={appStoreBadge}
          alt="App Store"
          unoptimized
          className={imgClassName}
        />
      </a>
      <a
        href={GOOGLE_PLAY_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Fairführer bei Google Play öffnen"
      >
        <Image
          src={googlePlayBadge}
          alt="Google Play"
          unoptimized
          className={imgClassName}
        />
      </a>
    </div>
  );
}

const CATEGORIES = [
  { id: 1, name: "Sehenswertes", color: "#E45858" },
  { id: 3, name: "Einkaufen", color: "#F0873D" },
  { id: 5, name: "Engagement", color: "#42D742" },
  { id: 8, name: "Unternehmen &\nHandwerk", color: "#E0D12E" },
  { id: 2, name: "Essen &\nÜbernachten", color: "#6477E3" },
] as const;

export default async function HomePage() {
  const content = await getHomePageContent();

  // Felder `traveler_content` und `partner_content` sind Markdown (Directus
  // `input-rich-text-md`). Vor dem Rendern in HTML konvertieren, sonst werden
  // **fett** und Absätze als Rohtext angezeigt.
  const travelerHtml = content?.traveler_content
    ? await marked(content.traveler_content)
    : "";
  const travelerVisionHtml = content?.traveler_vision
    ? await marked(content.traveler_vision)
    : "";
  // Links im partner_content sollen in neuem Tab öffnen: target + rel zu jedem <a>.
  const partnerHtml = content?.partner_content
    ? (await marked(content.partner_content)).replace(
        /<a /g,
        '<a target="_blank" rel="noopener noreferrer" ',
      )
    : "";
  const videoFeatureListHtml = content?.video_feature_list
    ? await marked(content.video_feature_list)
    : "";

  const c = (val?: string) =>
    val ? (val.startsWith("#") ? val : `#${val}`) : undefined;

  // Linki zewnętrzne (pełny adres http/https) otwieramy w nowej karcie.
  const isExternal = (url?: string) => !!url && /^https?:\/\//i.test(url);
  const externalProps = (url?: string) =>
    isExternal(url)
      ? { target: "_blank" as const, rel: "noopener noreferrer" }
      : {};

  // URL obrazu z cache-busterem (?v=<modified_on>) — wymusza świeży plik po
  // podmianie w Directusie pod tym samym UUID (asset ma Cache-Control 30 dni).
  const assetUrl = (
    img?: { id: string; modified_on?: string | null } | null,
  ) => {
    if (!img?.id) return undefined;
    const v = img.modified_on ? `?v=${Date.parse(img.modified_on)}` : "";
    return `${directusUrl}/assets/${img.id}${v}`;
  };

  const cssVars = {
    ...(c(content?.link_color) && {
      "--hp-link": c(content?.link_color),
    }),
    ...(content?.hero_background_color && {
      "--hero-bg": c(content.hero_background_color),
    }),
    ...(content?.hero_title_font_size && {
      "--fs-hero-title": content.hero_title_font_size,
    }),
    ...(content?.hero_title_color && {
      "--color-hero-title": c(content.hero_title_color),
    }),
    ...(content?.hero_title_mobile_font_size && {
      "--fs-hero-title-mobile": content.hero_title_mobile_font_size,
    }),
    ...(content?.hero_title_mobile_color && {
      "--color-hero-title-mobile": c(content.hero_title_mobile_color),
    }),
    ...(content?.hero_subtitle_font_size && {
      "--fs-hero-subtitle": content.hero_subtitle_font_size,
    }),
    ...(content?.hero_subtitle_color && {
      "--color-hero-subtitle": c(content.hero_subtitle_color),
    }),
    ...(content?.hero_button_font_size && {
      "--fs-hero-btn": content.hero_button_font_size,
    }),
    ...(content?.hero_button_color && {
      "--color-hero-btn": c(content.hero_button_color),
    }),
    ...(content?.hero_button_background_color && {
      "--bg-hero-btn": c(content.hero_button_background_color),
    }),
    ...(content?.hero_button_mobile_font_size && {
      "--fs-hero-btn-mobile": content.hero_button_mobile_font_size,
    }),
    ...(content?.hero_button_mobile_color && {
      "--color-hero-btn-mobile": c(content.hero_button_mobile_color),
    }),
    ...(content?.hero_button_background_color_mobile && {
      "--bg-hero-btn-mobile": c(content.hero_button_background_color_mobile),
    }),
    ...(content?.badges_label_font_size && {
      "--fs-badges-label": content.badges_label_font_size,
    }),
    ...(content?.badges_label_color && {
      "--color-badges-label": c(content.badges_label_color),
    }),
    ...(content?.section2_background_color && {
      "--bg-s2": c(content.section2_background_color),
    }),
    ...(content?.section2_title_font_size && {
      "--fs-s2-title": content.section2_title_font_size,
    }),
    ...(content?.section2_title_color && {
      "--color-s2-title": c(content.section2_title_color),
    }),
    ...(content?.section2_title_mobile_font_size && {
      "--fs-s2-title-mobile": content.section2_title_mobile_font_size,
    }),
    ...(content?.category_name_font_size && {
      "--fs-cat-name": content.category_name_font_size,
    }),
    ...(content?.category_name_color && {
      "--color-cat-name": c(content.category_name_color),
    }),
    ...(content?.category_name_mobile_font_size && {
      "--fs-cat-name-mobile": content.category_name_mobile_font_size,
    }),
    ...(content?.section4_background_color && {
      "--bg-s4": c(content.section4_background_color),
    }),
    ...(content?.section4_title_font_size && {
      "--fs-s4-title": content.section4_title_font_size,
    }),
    ...(content?.section4_title_color && {
      "--color-s4-title": c(content.section4_title_color),
    }),
    ...(content?.section4_title_mobile_font_size && {
      "--fs-s4-title-mobile": content.section4_title_mobile_font_size,
    }),
    ...(content?.section4_text_font_size && {
      "--fs-s4-text": content.section4_text_font_size,
    }),
    ...(content?.section4_text_color && {
      "--color-s4-text": c(content.section4_text_color),
    }),
    ...(content?.section4_text_mobile_font_size && {
      "--fs-s4-text-mobile": content.section4_text_mobile_font_size,
    }),
    ...(content?.section4_button_color && {
      "--color-s4-btn": c(content.section4_button_color),
    }),
    ...(content?.section4_button_font_size && {
      "--fs-s4-btn": content.section4_button_font_size,
    }),
    ...(content?.section4_button_background_color && {
      "--bg-s4-btn": c(content.section4_button_background_color),
    }),
    ...(content?.section4_button_mobile_font_size && {
      "--fs-s4-btn-mobile": content.section4_button_mobile_font_size,
    }),
  } as React.CSSProperties;

  const directusUrl = process.env.NEXT_PUBLIC_DIRECTUS_URL ?? "";

  return (
    <main className={styles.main} style={cssVars}>
      {/* SEKCJA 1: Hero */}
      <div className={styles.heroContainer}>
        <div className={styles.heroImageSide}>
          <Image
            src={heroImage}
            alt="FairFührer Guide Hero"
            fill
            priority
            unoptimized
            style={{ objectFit: "cover" }}
          />
        </div>
        <div className={styles.heroTextSide}>
          <h1 className={styles.heroTitle}>{content?.hero_title}</h1>
          <h3 className={styles.heroSubtitle}>{content?.hero_subtitle}</h3>
          <Link
            href={content?.hero_button_link ?? "#"}
            className={styles.heroButton}
          >
            <span>{content?.hero_button_text}</span>
          </Link>
        </div>
        <h1 className={styles.heroTitleMobile}>{content?.hero_title}</h1>
        <Link
          href={content?.hero_button_link ?? "#"}
          className={styles.heroButtonMobile}
        >
          <span>{content?.hero_button_text}</span>
        </Link>
        <div className={styles.heroBadgesBar}>
          <span className={styles.heroBadgesLabel}>
            {content?.badges_label}
          </span>
          <StoreBadgeLinks
            iconsClassName={styles.heroBadgesIcons}
            imgClassName={styles.heroBadgeImg}
          />
          <Image
            src={seenergienLogo}
            alt="Seenergien"
            unoptimized
            className={styles.heroBadgePartner}
          />
        </div>
      </div>

      {/* Store-Badges als eigener Abschnitt. Im Hero ist die Leiste auf
          Mobil ausgeblendet, weil sie dort mit dem CTA-Button kollidiert -
          hier stehen dieselben Inhalte untereinander. */}
      <section className={styles.heroBadgesMobile}>
        <span className={styles.heroBadgesMobileLabel}>
          {content?.badges_label}
        </span>
        <StoreBadgeLinks
          iconsClassName={styles.heroBadgesMobileIcons}
          imgClassName={styles.heroBadgeImg}
        />
        <Image
          src={seenergienLogo}
          alt="Seenergien"
          unoptimized
          className={styles.heroBadgesMobilePartner}
        />
      </section>

      {/* SEKCJA 2: Kategorie */}
      <section className={styles.section2}>
        <div className={styles.section2Content}>
          <h2 className={styles.section2Title}>{content?.section2_title}</h2>
          <div className={styles.categoriesList}>
            {CATEGORIES.map((cat) => {
              const iconPaths =
                getCategoryIconPaths(cat.id) ?? DEFAULT_ICON_PATHS;
              return (
                <div key={cat.name} className={styles.categoryItem}>
                  <svg
                    width={80}
                    height={80}
                    viewBox="0 0 80 80"
                    aria-hidden="true"
                  >
                    <circle cx="40" cy="40" r="38" fill={categoryColorFor(cat)} />
                    <circle cx="40" cy="40" r="28" fill="white" />
                    <g
                      transform="translate(22, 22) scale(1.5)"
                      fill="none"
                      stroke={categoryColorFor(cat)}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      dangerouslySetInnerHTML={{ __html: iconPaths }}
                    />
                  </svg>
                  <span className={styles.categoryName}>{cat.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SEKCJA 3: Traveler & Partner */}
      {(content?.traveler_title || content?.partner_title) && (
        <section className={styles.section3}>
          {content?.traveler_title && (
            <div
              className={styles.ctaFeatured}
              style={
                c(content?.traveler_background_color)
                  ? { backgroundColor: c(content.traveler_background_color) }
                  : undefined
              }
            >
              <div className={styles.ctaFeaturedMedia}>
                {content.traveler_image?.id ? (
                  <div className={styles.ctaFeaturedImageWrap}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={assetUrl(content.traveler_image)}
                      alt={content.traveler_title}
                      className={styles.ctaFeaturedImage}
                    />
                    <h2 className={styles.ctaFeaturedTitle}>
                      {content.traveler_title}
                    </h2>
                  </div>
                ) : (
                  <h2 className={styles.ctaTitle}>{content.traveler_title}</h2>
                )}
                {travelerVisionHtml && (
                  <div
                    className={styles.ctaFeaturedVision}
                    dangerouslySetInnerHTML={{ __html: travelerVisionHtml }}
                  />
                )}
              </div>
              <div className={styles.ctaFeaturedContent}>
                {travelerHtml && (
                  <div
                    className={styles.ctaText}
                    dangerouslySetInnerHTML={{ __html: travelerHtml }}
                  />
                )}
                {content.traveler_cta_label && content.traveler_cta_url && (
                  <Link
                    href={content.traveler_cta_url}
                    className={styles.ctaButton}
                    {...externalProps(content.traveler_cta_url)}
                  >
                    {content.traveler_cta_label}
                  </Link>
                )}
              </div>
            </div>
          )}

          {content?.partner_title && (
            <div
              className={`${styles.ctaBlock} ${styles.ctaBlockReverse}`}
              style={
                c(content?.partner_background_color)
                  ? { backgroundColor: c(content.partner_background_color) }
                  : undefined
              }
            >
              <div className={styles.ctaContent}>
                <h2 className={styles.ctaTitle}>{content.partner_title}</h2>
                {partnerHtml && (
                  <div
                    className={styles.ctaText}
                    dangerouslySetInnerHTML={{ __html: partnerHtml }}
                  />
                )}
                {content.partner_cta_label && content.partner_cta_url && (
                  <Link
                    href={content.partner_cta_url}
                    className={styles.ctaButton}
                    {...externalProps(content.partner_cta_url)}
                  >
                    {content.partner_cta_label}
                  </Link>
                )}
              </div>
              {content.partner_image?.id && (
                <div className={styles.ctaImage}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={assetUrl(content.partner_image)}
                    alt={content.partner_title}
                  />
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* SEKCJA 4: Fairführer-Video — 2 Spalten: links Video (60%), rechts Feature-Liste (40%) */}
      {content?.video_mux_playback_id && (
        <section
          className={styles.videoSection}
          style={{
            backgroundColor: content.video_background_color || "#ffffff",
          }}
        >
          <div className={styles.videoBlock}>
            <div className={styles.videoSide}>
              <ConditionalMuxVideo>
                <MuxVideoEmbed
                  playbackId={content.video_mux_playback_id}
                  thumbnailTime={content.video_thumbnail_time}
                  autoPlay={false}
                  muted={false}
                />
              </ConditionalMuxVideo>
            </div>
            {videoFeatureListHtml && (
              <div
                className={styles.videoTextSide}
                style={
                  c(content?.video_feature_list_background_color)
                    ? {
                        backgroundColor: c(
                          content.video_feature_list_background_color,
                        ),
                      }
                    : undefined
                }
              >
                <div
                  className={styles.videoFeatureList}
                  dangerouslySetInnerHTML={{ __html: videoFeatureListHtml }}
                />
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
