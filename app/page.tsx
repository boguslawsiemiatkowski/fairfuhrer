import React from "react";
import Image from "next/image";
import Link from "next/link";
import { marked } from "marked";
import heroImage from "@/public/fair-fuehrer-guide-hero.jpg";
import appStoreBadge from "@/public/app-store-badge.svg";
import googlePlayBadge from "@/public/android-store-badge.svg";
import seenergienLogo from "@/public/seenergienlogo.png";
import styles from "./page.module.css";
import { getHomePageContent } from "@/lib/directus";
import { getCategoryIconPaths, DEFAULT_ICON_PATHS } from "@/lib/categoryIcons";
import {
  audioUrlFor,
  fetchCategories,
  fetchPlacesCountByCategory,
  fetchPublishedPlacesCount,
} from "@/lib/orte";
import { categoryColorFor } from "@/components/CategoryIcon";
import HeroAudiopinStage from "@/components/HeroAudiopinStage";
import CategoryCards from "@/components/CategoryCards";
import MuxVideoEmbed from "@/components/MuxVideoEmbed";
import { ConditionalMuxVideo } from "@/components/ConditionalMuxVideo";
import LucideIcon from "@/components/LucideIcon";

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

// Die Kategorienamen kommen aus Directus und sind einzeilig. Lang genug, um
// umzubrechen, sind nur die mit „&“ — dort wird der Umbruch VOR dem zweiten
// Wort eingefügt, damit „Essen & Übernachten“ zweizeilig steht.
// `white-space: pre-line` an `.categoryName` zeigt das \n an.
function withLineBreak(name: string): string {
  return name.replace(/\s*&\s*/, " &\n");
}

export default async function HomePage() {
  // Öffentliche Directus-Adresse: die Bild- und Audioverweise werden im
  // Browser abgerufen. Stand vorher weiter unten, obwohl `assetUrl` sie
  // bereits oberhalb verwendete — das ging nur durch, weil `assetUrl` erst
  // im JSX aufgerufen wird.
  const directusUrl = process.env.NEXT_PUBLIC_DIRECTUS_URL ?? "";

  // Alles parallel: die Seite wartet sonst dreimal hintereinander auf
  // Directus. Kategorien und die Ortszahl haben eigene Cache-Tags
  // („kategorien“, „orte“), die die jeweiligen Flows erneuern.
  const [content, categories, placesCount, categoryCounts] = await Promise.all(
    [
      getHomePageContent(),
      fetchCategories(),
      fetchPublishedPlacesCount(),
      fetchPlacesCountByCategory(),
    ],
  );

  // Der Audiopin für das Hero wird in Directus ausgewählt. Hier wird nur
  // geprüft, ob daraus etwas Vorzeigbares wird: ohne Audioadresse gibt es
  // nichts anzuhören, und dann ist das alte Bild die bessere Wahl.
  //
  // Dass eine Adresse existiert, heißt nicht, dass die Datei dort liegt —
  // bei neun der 590 veröffentlichten Pins fehlt sie (Stand 2026-11-11).
  // Genau deshalb wählt die Redaktion den Pin aus und kein Zufall.
  const heroPin = content?.hero_audiopin ?? null;
  const heroAudioSrc = heroPin ? audioUrlFor(heroPin) : undefined;

  // Erstes Wort des Zurufs getrennt, damit es farbig gesetzt werden kann.
  // Die Trennung passiert hier und nicht im CSS, weil `::first-word` in CSS
  // nicht existiert — nur `::first-line` und `::first-letter`.
  const [firstWord = "", ...otherWords] = (content?.slogan_01 ?? "")
    .trim()
    .split(/\s+/);
  const restWords = otherWords.join(" ");

  // Felder `traveler_content` und `partner_content` sind Markdown (Directus
  // `input-rich-text-md`). Vor dem Rendern in HTML konvertieren, sonst werden
  // **fett** und Absätze als Rohtext angezeigt.
  //
  // BEWUSST OHNE SANITIZER, mit Begründung: `marked` lässt rohes HTML
  // unverändert durch — nachgemessen, auch `<script>`, `onerror=` und
  // `javascript:` in Links. Das ist hier kein Einfallstor, weil die Texte
  // ausschließlich aus Directus kommen und nur die Redaktion dort schreibt.
  // Ein Sanitizer würde eine Abhängigkeit kosten (DOMPurify braucht ein DOM,
  // das es in Server-Komponenten nicht gibt, also jsdom), ohne heute etwas
  // abzuwenden.
  //
  // Sobald Inhalte von außen kommen — Partner, die ihren Text selbst
  // einreichen, oder eine Wiederaufnahme der Community-Funktion — muss hier
  // sanitisiert werden. Dann am besten `dompurify` projektweit durch
  // `isomorphic-dompurify` ersetzen, damit Server und Browser dieselbe
  // Bibliothek verwenden (im Browser läuft DOMPurify bereits in
  // utils/popupGenerator.ts).
  // `traveler_content` und `traveler_vision` werden hier nicht mehr gelesen:
  // der lange Fließtext ist auf /ueber-uns zu Hause, auf der Startseite steht
  // jetzt der kurze Mission-Block. Die Felder bleiben in Directus erhalten.
  const missionHtml = content?.mission_text
    ? await marked(content.mission_text)
    : "";
  // Links im partner_content sollen in neuem Tab öffnen: target + rel zu jedem <a>.
  const partnerHtml = content?.partner_content
    ? (await marked(content.partner_content)).replace(
        /<a /g,
        '<a target="_blank" rel="noopener noreferrer" ',
      )
    : "";
  const zweiWegeFeaturesHtml = content?.zwei_wege_features
    ? await marked(content.zwei_wege_features)
    : "";

  // Das Repeater-Feld kommt als JSON aus Directus. Ein leeres Feld liefert
  // `null`, ein frisch angelegtes kann auch mal einen String enthalten —
  // deshalb erst prüfen, dann filtern: Zeilen ohne Text fallen raus, damit
  // keine leeren Punkte mit Symbol stehen bleiben.
  const partnerVorteile = Array.isArray(content?.partner_cta_vorteile)
    ? content.partner_cta_vorteile.filter((v) => v?.text)
    : [];

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

  return (
    <main className={styles.main} style={cssVars}>
      {/* SEKCJA 1: Hero */}
      <div className={styles.heroContainer}>
        {/* Links steht ein Audiopin zum Anhören, nicht mehr ein bloßes Bild:
            die Seite verspricht „in 100 Sekunden die Geschichte dahinter“ —
            hier kann man das sofort nachprüfen.

            Welcher Pin, entscheidet die Redaktion in Directus. Fehlt die
            Auswahl oder hat der Pin kein Audio, bleibt das alte Bild stehen;
            das Hero darf an dieser Stelle nicht zerbrechen. */}
        <div className={styles.heroImageSide}>
          {heroPin && heroAudioSrc ? (
            <HeroAudiopinStage
              pin={heroPin}
              audioSrc={heroAudioSrc}
              placesCount={placesCount}
              directusUrl={directusUrl}
            />
          ) : (
            <Image
              src={heroImage}
              alt="FairFührer Guide Hero"
              fill
              priority
              unoptimized
              style={{ objectFit: "cover" }}
            />
          )}
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
            {categories.map((cat) => {
              const iconPaths =
                getCategoryIconPaths(cat.id) ?? DEFAULT_ICON_PATHS;
              const color = categoryColorFor(cat);
              return (
                <div key={cat.id} className={styles.categoryItem}>
                  <svg
                    width={80}
                    height={80}
                    viewBox="0 0 80 80"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <circle cx="40" cy="40" r="38" fill={color} />
                    <circle cx="40" cy="40" r="28" fill="white" />
                    <g
                      transform="translate(22, 22) scale(1.5)"
                      fill="none"
                      stroke={color}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      // Feste Zeichenketten aus lib/categoryIcons.ts, nach
                      // `cat.id` ausgewählt — keine Directus-Inhalte.
                      dangerouslySetInnerHTML={{ __html: iconPaths }}
                    />
                  </svg>
                  <span className={styles.categoryName}>
                    {withLineBreak(cat.name)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SEKCJA 2b: Karten zu den Kategorien
          Die Kreise darüber benennen die fünf Kategorien, sagen aber nicht,
          was sich dahinter verbirgt, und führen nirgendwohin. Diese Karten
          ergänzen beides: Beschreibungstext aus Directus, Zahl der Orte und
          ein Verweis auf die gefilterte Liste. */}
      {categories.length > 0 && (
        <section className={styles.categoryCardsSection}>
          <div className={styles.categoryCardsInner}>
            <CategoryCards categories={categories} counts={categoryCounts} />
          </div>
        </section>
      )}

      {/* SEKCJA 2c: Zuruf
          Nach den hellen Karten ein dunkles Band, auf dem nur ein Satz
          steht. Der Bruch gibt der Seite Luft und hebt das hervor, was
          FairFührer am stärksten für sich hat und bisher nirgends oben
          stand: dass es nichts kostet. */}
      {content?.slogan_01 && (
        <section className={styles.sloganSection}>
          <div className={styles.sloganInner}>
            <p className={styles.sloganHeadline}>
              {/* Nur das erste Wort in der Markenfarbe — „kostenlos“ ist das
                  Argument, der Rest ist Satzbau. */}
              <span className={styles.sloganAccent}>{firstWord}</span>
              {restWords && <span> {restWords}</span>}
            </p>
            {content.slogan_02 && (
              <p className={styles.sloganText}>{content.slogan_02}</p>
            )}
            {content.app_icon?.id && (
              /* Drei Wege nebeneinander: links Google Play, in der Mitte die
                 Karte im Browser, rechts der App Store.

                 Die Ladenzeichen stehen auch oben in der Hero-Leiste, dort
                 aber klein und zwischen anderem. Auf breiten Schirmen geht
                 das unter; auf dem Telefon hat die Leiste einen eigenen
                 Abschnitt und ist deutlich genug — deshalb blendet das CSS
                 diese Reihe dort aus statt sie zu wiederholen. */
              <div className={styles.sloganWege}>
                <a
                  href={GOOGLE_PLAY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.sloganStore}
                  aria-label="Fairführer bei Google Play öffnen"
                >
                  <Image
                    src={googlePlayBadge}
                    alt="Google Play"
                    unoptimized
                    className={styles.sloganStoreImg}
                  />
                </a>

                <Link
                  href="/karte"
                  className={styles.sloganIconLink}
                  aria-label="Zur interaktiven Karte"
                >
                  <Image
                    src={assetUrl(content.app_icon) ?? ""}
                    alt=""
                    aria-hidden="true"
                    width={content.app_icon.width ?? 128}
                    height={content.app_icon.height ?? 128}
                    sizes="104px"
                    className={styles.sloganIcon}
                  />
                </Link>

                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.sloganStore}
                  aria-label="Fairführer im App Store öffnen"
                >
                  <Image
                    src={appStoreBadge}
                    alt="App Store"
                    unoptimized
                    className={styles.sloganStoreImg}
                  />
                </a>
              </div>
            )}
          </div>
        </section>
      )}

      {/* SEKCJA 2d: Zwei Wege — Liste und Karte nebeneinander
          Der Abschnitt beantwortet die Frage, die der Zuruf darüber offen
          lässt: wie sieht das eigentlich aus? Zwei Bilder sagen das
          schneller als ein Film, den man erst starten müsste. */}
      {content?.zwei_wege_titel && (
        <section className={styles.zweiWegeSection}>
          <div className={styles.zweiWegeInner}>
            <h2 className={styles.zweiWegeTitel}>{content.zwei_wege_titel}</h2>

            <div className={styles.zweiWegeGrid}>
              {/* Beide Spalten sind Verweise: wer das Bild sieht und es
                  ausprobieren will, soll nicht erst einen Knopf suchen. */}
              <Link href="/liste" className={styles.wegKarte}>
                {content.liste_bild?.id && (
                  <span className={styles.wegBildWrap}>
                    <Image
                      src={assetUrl(content.liste_bild) ?? ""}
                      alt=""
                      aria-hidden="true"
                      width={content.liste_bild.width ?? 800}
                      height={content.liste_bild.height ?? 600}
                      sizes="(max-width: 860px) 94vw, 640px"
                      className={styles.wegBild}
                    />
                  </span>
                )}
                <span className={styles.wegInhalt}>
                  {content.liste_titel && (
                    <span className={styles.wegTitel}>
                      {content.liste_titel}
                    </span>
                  )}
                  {content.liste_text && (
                    <span className={styles.wegText}>{content.liste_text}</span>
                  )}
                  <span className={styles.wegPfeil} aria-hidden="true">
                    →
                  </span>
                </span>
              </Link>

              <Link href="/karte" className={styles.wegKarte}>
                {content.karte_bild?.id && (
                  <span className={styles.wegBildWrap}>
                    <Image
                      src={assetUrl(content.karte_bild) ?? ""}
                      alt=""
                      aria-hidden="true"
                      width={content.karte_bild.width ?? 800}
                      height={content.karte_bild.height ?? 600}
                      sizes="(max-width: 860px) 94vw, 640px"
                      className={styles.wegBild}
                    />
                  </span>
                )}
                <span className={styles.wegInhalt}>
                  {content.karte_titel && (
                    <span className={styles.wegTitel}>
                      {content.karte_titel}
                    </span>
                  )}
                  {content.karte_text && (
                    <span className={styles.wegText}>{content.karte_text}</span>
                  )}
                  <span className={styles.wegPfeil} aria-hidden="true">
                    →
                  </span>
                </span>
              </Link>
            </div>

            {zweiWegeFeaturesHtml && (
              <div
                className={styles.zweiWegeFeatures}
                dangerouslySetInnerHTML={{ __html: zweiWegeFeaturesHtml }}
              />
            )}

            {/* App-Hinweis mit Film — zwei Bilder zeigen die Webseite, der
                Film zeigt, dass es dasselbe auch als App gibt. Beides
                antwortet auf „wie sieht das aus?“, also steht es zusammen
                und nicht in einem eigenen Abschnitt.

                Rahmen und Schatten sind unverändert aus dem früheren
                Video-Abschnitt übernommen. */}
            {content.app_hinweis_titel && content.video_mux_playback_id && (
              <div className={styles.appHinweis}>
                <h3 className={styles.appHinweisTitel}>
                  {content.app_hinweis_titel}
                </h3>
                <div className={styles.videoFrame}>
                  <ConditionalMuxVideo>
                    <MuxVideoEmbed
                      playbackId={content.video_mux_playback_id}
                      thumbnailTime={content.video_thumbnail_time}
                      autoPlay={false}
                      muted={false}
                    />
                  </ConditionalMuxVideo>
                </div>

                {/* Der Kern der Sache steht unter dem Film, nicht daneben:
                    der Satz stammt aus genau diesem Film, und ein Bild
                    daneben wäre ein zweites Mal dieselbe Szene. */}
                {content.mission_titel && (
                  <div className={styles.missionInhalt}>
                    <h2 className={styles.missionTitel}>
                      {content.mission_titel}
                    </h2>
                    {missionHtml && (
                      <div
                        className={styles.missionText}
                        dangerouslySetInnerHTML={{ __html: missionHtml }}
                      />
                    )}
                    {content.mission_cta_label && content.mission_cta_url && (
                      <Link
                        href={content.mission_cta_url}
                        className={styles.missionLink}
                        {...externalProps(content.mission_cta_url)}
                      >
                        {content.mission_cta_label}
                        <span aria-hidden="true"> →</span>
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* SEKCJA 3: Partner
          Der Mission-Block stand hier mit einem Bild daneben — dasselbe
          Motiv, das auch im Film zu sehen ist, und dort noch dazu mit dem
          alten Stand der App. Zweimal dieselbe Szene untereinander war
          aufdringlich; der Text steht jetzt unter dem Film selbst. */}
      {content?.partner_title && (
        <section className={styles.section3}>
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
                  {/* Die Quelldatei ist 3471×3471 px groß und stand bisher
                      unverkleinert in einer 36 % breiten Spalte. `sizes` sagt
                      dem Loader, wie breit sie wirklich erscheint. */}
                  <Image
                    src={assetUrl(content.partner_image) ?? ""}
                    alt={content.partner_title ?? ""}
                    width={content.partner_image.width ?? 1000}
                    height={content.partner_image.height ?? 1000}
                    sizes="(max-width: 900px) 92vw, 36vw"
                  />
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* SEKCJA 4: Partner-Aufruf — der Schluss der Seite
          Bis hierher spricht die Seite zu Besuchern. Dieser Abschnitt
          wendet sich an die andere Seite: an Betriebe, Vereine und
          Projekte, die aufgenommen werden wollen.

          Dunkles Band wie beim Zuruf weiter oben — die Seite bekommt damit
          eine Klammer, und der Farbwechsel sagt ohne Worte, dass hier ein
          anderer Adressat gemeint ist. */}
      {content?.partner_cta_titel && (
        <section className={styles.partnerCta}>
          <div className={styles.partnerCtaInner}>
            <h2 className={styles.partnerCtaTitel}>
              {content.partner_cta_titel}
            </h2>

            {content.partner_cta_text && (
              <p className={styles.partnerCtaText}>{content.partner_cta_text}</p>
            )}

            {partnerVorteile.length > 0 && (
              <ul className={styles.partnerCtaVorteile}>
                {partnerVorteile.map((vorteil, i) => (
                  <li key={i} className={styles.partnerCtaVorteil}>
                    {/* Die Symbole sind Schmuck, kein Inhalt: der
                        Screenreader soll den Text vorlesen, nicht
                        „Symbol Mikrofon“ davor. */}
                    <span className={styles.partnerCtaIcon}>
                      <LucideIcon
                        name={vorteil.icon}
                        size={28}
                        strokeWidth={1.5}
                        aria-hidden
                      />
                    </span>
                    <span className={styles.partnerCtaVorteilText}>
                      {vorteil.text}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {content.partner_cta_button_label &&
              content.partner_cta_button_url && (
                <Link
                  href={content.partner_cta_button_url}
                  className={styles.partnerCtaButton}
                  {...externalProps(content.partner_cta_button_url)}
                >
                  {content.partner_cta_button_label}
                  <span aria-hidden="true"> →</span>
                </Link>
              )}
          </div>
        </section>
      )}

      {/* Der frühere Abschnitt 4 (Video links, Merkmalliste rechts) ist
          entfallen. Das Video steht jetzt oben im Zuruf-Abschnitt, wo es
          direkt auf den Satz folgt, der es ankündigt. Die Liste
          („über 600 PINs entdecken …") wurde bewusst nicht mitgenommen:
          ihr letzter Punkt lautete „kostenlos loslegen" und hätte den
          Zuruf darüber wiederholt.

          Die Felder `video_feature_list` und `video_feature_list_background_color`
          bleiben in Directus erhalten — die Liste lässt sich jederzeit
          zurückholen. */}
    </main>
  );
}
