// app/ueber-uns/page.tsx
// Strona "Über uns" — historia powstania Fairführera w stylistyce Studio.
// Treść pobierana z Directusa (ueber_uns_content + prozess_items + werte_items).
// Kolory i rozmiary fontów z Directusa mają pierwszeństwo (z bezpiecznymi fallbackami Studio).

import React, { Fragment } from "react";
import { Metadata } from "next";
import Link from "next/link";
import { marked } from "marked";
import { getUeberUnsContent, getContactFormContent } from "@/lib/directus";
import LucideIcon from "@/components/LucideIcon";
import { ArrowRight, AtSign, Compass, MapPinHouse, Users } from "lucide-react";
import styles from "./ueber-uns.module.css";

const directusUrl = process.env.NEXT_PUBLIC_DIRECTUS_URL ?? "";

export const metadata: Metadata = {
  title: "Über uns",
  description:
    "Die Geschichte hinter dem Fairführer — von der ersten Idee zum digitalen Audioguide für faire und nachhaltige Orte.",
};

export default async function UeberUnsPage() {
  const [data, contact] = await Promise.all([
    getUeberUnsContent(),
    getContactFormContent(),
  ]);

  if (!data) {
    return (
      <main className={styles.main}>
        <div className={styles.errorMessage}>
          <h1>Seite nicht gefunden</h1>
          <p>Die angeforderte Seite konnte nicht geladen werden.</p>
        </div>
      </main>
    );
  }

  // Konwersja Markdown -> HTML z automatycznym otwieraniem linków zewnętrznych w nowej karcie
  const externalizeLinks = (html: string) =>
    html.replace(
      /<a\s+href="(https?:\/\/[^"]+)"/gi,
      '<a href="$1" target="_blank" rel="noopener noreferrer"',
    );
  const md = async (v?: string) => (v ? externalizeLinks(await marked(v)) : "");

  const [
    heroIntroHtml,
    seenergienHtml,
    audioguideHtml,
    handarbeitHtml,
    wachstHtml,
    abschlussHtml,
  ] = await Promise.all([
    md(data.hero_intro),
    md(data.seenergien_text),
    md(data.audioguide_text),
    md(data.handarbeit_text),
    md(data.wachst_text),
    md(data.abschluss_text),
  ]);

  const werteHtml = await Promise.all(
    (data.werte_items ?? []).map((w) => md(w.text)),
  );

  const c = (val?: string) =>
    val ? (val.startsWith("#") ? val : `#${val}`) : undefined;

  // Dla jasnych kart Studio (np. w sekcji Kontakt): jeśli w Directusie ustawiono
  // biały kolor tekstu pod dawne pomarańczowe tło, zamieniamy go na granat Studio (#18222f),
  // aby zachować pełny kontrast na białej karcie.
  const cOnWhiteCard = (val?: string, fallback = "#18222f") => {
    const normalized = c(val);
    if (!normalized) return fallback;
    if (/^#f{3,6}$/i.test(normalized)) return fallback;
    return normalized;
  };

  const asset = (id?: string) => (id ? `${directusUrl}/assets/${id}` : null);

  // Styl pojedynczego elementu: kolor (z fallbackiem) + opcjonalny rozmiar fontu z Directusa.
  const st = (
    color?: string,
    fallback?: string,
    fontSize?: string,
  ): React.CSSProperties => ({
    ...(c(color) || fallback ? { color: c(color) || fallback } : {}),
    ...(fontSize ? { fontSize } : {}),
  });

  // Tło sekcji (ustawiane tylko, gdy podano wartość w Directusie — inaczej działa domyślny styl CSS).
  const bg = (val?: string): React.CSSProperties | undefined =>
    c(val) ? { backgroundColor: c(val) } : undefined;

  const media = (
    id: string | undefined,
    alt: string,
    variant: "framed" | "contain" = "framed",
  ) =>
    asset(id) ? (
      <div
        className={
          variant === "contain"
            ? styles.mediaContainWrap
            : styles.mediaFrameWrap
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset(id) as string}
          alt={alt}
          className={
            variant === "contain"
              ? styles.sectionImageContain
              : styles.sectionImage
          }
        />
      </div>
    ) : (
      <div className={styles.imagePlaceholder}>
        <span>Bild fehlt — bitte im Directus hochladen.</span>
      </div>
    );

  const prozess = data.prozess_items ?? [];
  const werte = data.werte_items ?? [];

  return (
    <main className={styles.main}>
      {/* 1 — HERO */}
      <section className={styles.hero} style={bg(data.hero_background_color)}>
        {asset(data.hero_image) && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset(data.hero_image) as string}
              alt=""
              className={styles.heroImage}
            />
            <div className={styles.heroBackdropOverlay} aria-hidden />
          </>
        )}
        <div className={styles.heroInner}>
          <div className={styles.heroCard}>
            <span className={styles.heroEyebrow}>Über uns</span>
            {data.hero_title && (
              <h1
                className={styles.heroTitle}
                style={st(
                  data.hero_title_color,
                  "#3e6b4f",
                  data.hero_title_font_size,
                )}
              >
                {data.hero_title}
              </h1>
            )}
            {heroIntroHtml && (
              <div
                className={`${styles.heroIntro} ${styles.prose}`}
                style={st(
                  data.hero_intro_color,
                  "#18222f",
                  data.hero_intro_font_size,
                )}
                dangerouslySetInnerHTML={{ __html: heroIntroHtml }}
              />
            )}
          </div>
        </div>
      </section>

      {/* 2 — SEENERGIEN */}
      {(seenergienHtml || data.seenergien_image) && (
        <section
          className={styles.seenergien}
          style={bg(data.seenergien_background_color)}
        >
          <div className={styles.seenergienInner}>
            <div className={styles.seenergienText}>
              {seenergienHtml && (
                <div
                  className={styles.prose}
                  style={st(
                    data.seenergien_text_color,
                    "#18222f",
                    data.seenergien_text_font_size,
                  )}
                  dangerouslySetInnerHTML={{ __html: seenergienHtml }}
                />
              )}
            </div>
            <div className={styles.seenergienMedia}>
              {media(data.seenergien_image, "Seenergien", "contain")}
            </div>
          </div>
        </section>
      )}

      {/* 3 — AUDIOGUIDE (Bild links | Text rechts) */}
      {(audioguideHtml || data.audioguide_title) && (
        <section
          className={styles.splitSection}
          style={bg(data.audioguide_background_color)}
        >
          <div className={styles.splitInner}>
            <div className={styles.splitMedia}>
              {media(data.audioguide_image, "Audioguide", "framed")}
            </div>
            <div className={styles.splitText}>
              {data.audioguide_title && (
                <h2
                  className={styles.sectionTitle}
                  style={st(
                    data.audioguide_title_color,
                    "#3e6b4f",
                    data.audioguide_title_font_size,
                  )}
                >
                  {data.audioguide_title}
                </h2>
              )}
              {audioguideHtml && (
                <div
                  className={styles.prose}
                  style={st(
                    data.audioguide_text_color,
                    "#18222f",
                    data.audioguide_text_font_size,
                  )}
                  dangerouslySetInnerHTML={{ __html: audioguideHtml }}
                />
              )}
            </div>
          </div>
        </section>
      )}

      {/* 4 — HANDARBEIT (Text links | Bild rechts) */}
      {(handarbeitHtml || data.handarbeit_image) && (
        <section
          className={`${styles.splitSection} ${styles.splitSectionAlt}`}
          style={bg(data.handarbeit_background_color)}
        >
          <div className={`${styles.splitInner} ${styles.splitReverse}`}>
            <div className={styles.splitMedia}>
              {media(data.handarbeit_image, "Team", "framed")}
            </div>
            <div className={styles.splitText}>
              {handarbeitHtml && (
                <div
                  className={styles.prose}
                  style={st(
                    data.handarbeit_text_color,
                    "#18222f",
                    data.handarbeit_text_font_size,
                  )}
                  dangerouslySetInnerHTML={{ __html: handarbeitHtml }}
                />
              )}
            </div>
          </div>
        </section>
      )}

      {/* 5 — WÄCHST + PROZESS (Bild links | Text+Prozess rechts) */}
      {(wachstHtml || data.wachst_title || prozess.length > 0) && (
        <section
          className={styles.splitSection}
          style={bg(data.wachst_background_color)}
        >
          <div className={styles.splitInner}>
            <div className={styles.splitMedia}>
              {media(data.wachst_image, "Fairführer", "framed")}
            </div>
            <div className={styles.splitText}>
              {data.wachst_title && (
                <h2
                  className={styles.sectionTitle}
                  style={st(
                    data.wachst_title_color,
                    "#3e6b4f",
                    data.wachst_title_font_size,
                  )}
                >
                  {data.wachst_title}
                </h2>
              )}
              {wachstHtml && (
                <div
                  className={styles.prose}
                  style={st(
                    data.wachst_text_color,
                    "#18222f",
                    data.wachst_text_font_size,
                  )}
                  dangerouslySetInnerHTML={{ __html: wachstHtml }}
                />
              )}
              {prozess.length > 0 && (
                <div className={styles.prozess}>
                  {prozess.map((step, i) => (
                    <Fragment key={step.id}>
                      <div className={styles.prozessStep}>
                        <div className={styles.prozessIconWrap}>
                          <span className={styles.prozessStepNumber}>
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <div className={styles.prozessIcon}>
                            <LucideIcon name={step.icon} size={30} />
                          </div>
                        </div>
                        {step.label && (
                          <span
                            className={styles.prozessLabel}
                            style={st(
                              data.prozess_label_color,
                              "#18222f",
                              data.prozess_label_font_size,
                            )}
                          >
                            {step.label}
                          </span>
                        )}
                      </div>
                      {i < prozess.length - 1 && (
                        <ArrowRight
                          className={styles.prozessArrow}
                          size={22}
                          aria-hidden
                        />
                      )}
                    </Fragment>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 6 — WERTE (Titel + 3 Spalten w kartach Studio) */}
      {(data.werte_title || werte.length > 0) && (
        <section className={styles.werte} style={bg(data.werte_background_color)}>
          <div className={styles.werteInner}>
            {data.werte_title && (
              <h2
                className={styles.werteTitle}
                style={st(
                  data.werte_title_color,
                  "#3e6b4f",
                  data.werte_title_font_size,
                )}
              >
                {data.werte_title}
              </h2>
            )}
            {werte.length > 0 && (
              <div className={styles.werteGrid}>
                {werte.map((w, i) => (
                  <article key={w.id} className={styles.werteCard}>
                    <div className={styles.werteIconBadge}>
                      <LucideIcon name={w.icon} size={30} />
                    </div>
                    {w.title && (
                      <h3
                        className={styles.werteCardTitle}
                        style={st(
                          data.werte_card_title_color,
                          "#fc6c14",
                          data.werte_card_title_font_size,
                        )}
                      >
                        {w.title}
                      </h3>
                    )}
                    {werteHtml[i] && (
                      <div
                        className={`${styles.werteCardText} ${styles.prose}`}
                        style={st(
                          data.werte_card_text_color,
                          "#18222f",
                          data.werte_card_text_font_size,
                        )}
                        dangerouslySetInnerHTML={{ __html: werteHtml[i] }}
                      />
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 6.5 — ABSCHLUSS + PRZYCISKI AKCJI (Wsparcie dla pola abschluss_text z Directusa + nawigacja) */}
      <section
        className={styles.abschlussSection}
        style={bg(data.abschluss_background_color)}
      >
        <div className={styles.abschlussInner}>
          {abschlussHtml && (
            <div
              className={`${styles.abschlussText} ${styles.prose}`}
              style={st(
                data.abschluss_text_color,
                "#18222f",
                data.abschluss_text_font_size,
              )}
              dangerouslySetInnerHTML={{ __html: abschlussHtml }}
            />
          )}
          <div className={styles.abschlussActions}>
            <Link href="/karte" className={styles.primaryStudioCta}>
              <Compass size={19} aria-hidden />
              <span>Orte auf der Karte entdecken</span>
              <ArrowRight size={18} aria-hidden />
            </Link>
            <Link href="/partner-werden" className={styles.secondaryStudioCta}>
              <Users size={19} aria-hidden />
              <span>Beim Fairführer mitmachen</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 7 — KONTAKT (Adresse + E-Mail — aus contact_form_content w kartach Studio) */}
      {contact && (contact.adresse || contact.email) && (
        <section
          className={styles.kontakt}
          style={bg(contact.background_color) ?? { backgroundColor: "#fc6c14" }}
        >
          <div className={styles.kontaktInner}>
            {contact.title && (
              <h2
                className={styles.kontaktTitle}
                style={st(contact.title_color, "#18222f", contact.title_font_size)}
              >
                {contact.title}
              </h2>
            )}
            <div className={styles.kontaktCards}>
              {contact.adresse && (
                <div className={styles.kontaktCard}>
                  <div className={styles.kontaktIcon}>
                    <MapPinHouse size={24} aria-hidden />
                  </div>
                  <div className={styles.kontaktCardBody}>
                    <h3 className={styles.kontaktCardLabel}>Adresse</h3>
                    <p
                      style={{
                        color: cOnWhiteCard(contact.contact_fields_color, "#18222f"),
                        ...(contact.contact_fields_font_size
                          ? { fontSize: contact.contact_fields_font_size }
                          : {}),
                      }}
                    >
                      {contact.adresse.split("\n").map((line, i, arr) => (
                        <Fragment key={i}>
                          {line}
                          {i < arr.length - 1 && <br />}
                        </Fragment>
                      ))}
                    </p>
                  </div>
                </div>
              )}
              {contact.email && (
                <div className={styles.kontaktCard}>
                  <div className={styles.kontaktIcon}>
                    <AtSign size={24} aria-hidden />
                  </div>
                  <div className={styles.kontaktCardBody}>
                    <h3 className={styles.kontaktCardLabel}>E-Mail</h3>
                    <p>
                      <a
                        href={`mailto:${contact.email}`}
                        className={styles.kontaktEmailLink}
                        style={{
                          color: cOnWhiteCard(contact.contact_fields_color, "#fc6c14"),
                          ...(contact.contact_fields_font_size
                            ? { fontSize: contact.contact_fields_font_size }
                            : {}),
                        }}
                      >
                        {contact.email}
                      </a>
                    </p>
                    {contact.email_description && (
                      <span
                        className={styles.kontaktEmailDesc}
                        style={{
                          color: cOnWhiteCard(
                            contact.email_description_color,
                            "#475569",
                          ),
                          ...(contact.email_description_font_size
                            ? { fontSize: contact.email_description_font_size }
                            : {}),
                        }}
                      >
                        {contact.email_description}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
