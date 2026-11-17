// app/partner-werden/page.tsx
// Partnerseite: Preise zuerst, dann Leistungen, Studio, Plattformen,
// Aufnahmekriterien und zum Schluss der Knopf samt PayPal-Hinweis.
//
// Die Inhalte kommen aus der Sammlung `partner_werden_content`. Die alte
// Sammlung `partner_page_content` ist in Directus rot als „VERALTET“
// markiert und bleibt unangetastet — sie diente als Vorlage.
//
// ⚠ Die Beträge in Directus müssen zu den PayPal-Plänen passen
// (25/50/100/200 netto). Eine Änderung dort ändert NICHT, was abgebucht
// wird — dafür sind die Pläne im PayPal-Konto zuständig.

import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { marked } from "marked";
import { getPartnerWerdenContent } from "@/lib/directus";
import LucideIcon from "@/components/LucideIcon";
import MuxVideoEmbed from "@/components/MuxVideoEmbed";
import { ConditionalMuxVideo } from "@/components/ConditionalMuxVideo";
import appStoreBadge from "@/public/app-store-badge.svg";
import googlePlayBadge from "@/public/android-store-badge.svg";
import styles from "./partner-werden.module.css";

const APP_STORE_URL =
  "https://apps.apple.com/de/app/fairf%C3%BChrer/id6778095803";
const GOOGLE_PLAY_URL =
  "https://play.google.com/store/apps/details?id=com.fairfuehrer.app";

const directusUrl = process.env.NEXT_PUBLIC_DIRECTUS_URL!;

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Partner werden",
  description:
    "Macht euer nachhaltiges Engagement hörbar: Audiobeitrag, Karte, Liste und Studio. Preise ab 25 € im Jahr.",
};

export default async function PartnerWerdenPage() {
  const content = await getPartnerWerdenContent();

  if (!content) {
    return (
      <main className={styles.main}>
        <div className={styles.fehler}>
          <h1>Seite nicht gefunden</h1>
          <p>Die angeforderte Seite konnte nicht geladen werden.</p>
        </div>
      </main>
    );
  }

  // `modified_on` als Cache-Buster: wird eine Datei unter derselben UUID
  // ersetzt, bliebe sonst 30 Tage lang die alte im Browser-Cache.
  const assetUrl = (
    img?: { id: string; modified_on?: string | null } | null,
  ) => {
    if (!img?.id) return undefined;
    const v = img.modified_on ? `?v=${Date.parse(img.modified_on)}` : "";
    return `${directusUrl}/assets/${img.id}${v}`;
  };

  const [
    preiseIntroHtml,
    steuerHtml,
    studioHtml,
    plattformenHtml,
    kriterienIntroHtml,
  ] = await Promise.all([
    content.preise_intro ? marked(content.preise_intro) : "",
    content.preise_steuerhinweis ? marked(content.preise_steuerhinweis) : "",
    content.studio_text ? marked(content.studio_text) : "",
    content.plattformen_text ? marked(content.plattformen_text) : "",
    content.kriterien_intro ? marked(content.kriterien_intro) : "",
  ]);

  // Die Repeater kommen als JSON und sind bei leerem Feld `null`. Zeilen
  // ohne Inhalt fallen raus, damit kein leerer Kasten stehen bleibt.
  const stufen = Array.isArray(content.preise_stufen)
    ? content.preise_stufen.filter((s) => s?.titel)
    : [];
  const leistungen = Array.isArray(content.leistungen)
    ? content.leistungen.filter((l) => l?.titel)
    : [];
  const kriterienGruppen = Array.isArray(content.kriterien_gruppen)
    ? content.kriterien_gruppen.filter((g) => g?.titel)
    : [];

  // Der Markdown der Kriterien wird erst hier gerendert, weil die Zahl der
  // Gruppen aus Directus kommt und nicht feststeht.
  const kriterienHtml = await Promise.all(
    kriterienGruppen.map((g) => (g.text ? marked(g.text) : "")),
  );

  return (
    <main className={styles.main}>
      {/* HERO — kurz gehalten: die Preise darunter sind der eigentliche
          Grund, warum jemand diese Seite öffnet. */}
      {content.hero_titel && (
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <h1 className={styles.heroTitel}>{content.hero_titel}</h1>
            {content.hero_text && (
              <p className={styles.heroText}>{content.hero_text}</p>
            )}

            {/* Wer hinter dem Fairführer steht: ein Betrieb, der eine
                Partnerschaft erwägt, will wissen, mit wem er es zu tun hat.
                Das Zeichen beantwortet das, bevor die Preise kommen.

                `alt` benennt das Unternehmen — anders als die Symbole der
                Seite ist das hier Inhalt, kein Schmuck. */}
            {content.seenergien_logo?.id && (
              <div className={styles.seenergienRahmen}>
                <Image
                  src={assetUrl(content.seenergien_logo) ?? ""}
                  alt="Seenergien GmbH"
                  width={content.seenergien_logo.width ?? 3000}
                  height={content.seenergien_logo.height ?? 900}
                  sizes="(max-width: 560px) 150px, 190px"
                  className={styles.seenergienLogo}
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* PREISE — ganz oben, wie von Bogusław gewünscht. Netto groß,
          brutto klein darunter: B2B denkt in netto, aber der deutsche
          Kunde zahlt am Ende den Bruttobetrag und soll ihn vorher sehen. */}
      {content.preise_titel && (
        <section className={styles.preise} id="preise">
          <div className={styles.inner}>
            <h2 className={styles.abschnittTitel}>{content.preise_titel}</h2>

            {preiseIntroHtml && (
              <div
                className={styles.abschnittIntro}
                dangerouslySetInnerHTML={{ __html: preiseIntroHtml }}
              />
            )}

            {stufen.length > 0 && (
              <ul className={styles.preisGitter}>
                {stufen.map((stufe, i) => (
                  <li
                    key={i}
                    className={`${styles.preisKarte} ${
                      stufe.hervorheben ? styles.preisKarteHervor : ""
                    }`}
                  >
                    <span className={styles.preisStufe}>{stufe.titel}</span>
                    {stufe.zielgruppe && (
                      <span className={styles.preisZielgruppe}>
                        {stufe.zielgruppe}
                      </span>
                    )}
                    {stufe.preis_netto && (
                      <span className={styles.preisNetto}>
                        {stufe.preis_netto}
                        <span className={styles.preisEinheit}>
                          {" "}
                          / Jahr netto
                        </span>
                      </span>
                    )}
                    {stufe.preis_brutto && (
                      <span className={styles.preisBrutto}>
                        {stufe.preis_brutto} inkl. 19 % MwSt.
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* Steht für sich: „keine automatische Verlängerung“ nimmt die
                größte Sorge bei wiederkehrenden Zahlungen, und das darf
                nicht im Kleingedruckten untergehen. */}
            {content.preise_keine_verlaengerung && (
              <p className={styles.keineVerlaengerung}>
                <LucideIcon name="BadgeCheck" size={20} strokeWidth={2} />
                <span>{content.preise_keine_verlaengerung}</span>
              </p>
            )}

            {steuerHtml && (
              <div
                className={styles.steuerhinweis}
                dangerouslySetInnerHTML={{ __html: steuerHtml }}
              />
            )}

            {/* Zweiter Weg zur Anmeldung, direkt bei den Preisen: wer hier
                die passende Stufe gefunden hat, will oft sofort sehen, wie
                das Konto aussieht — und soll dafür nicht bis ans Seitenende
                scrollen müssen.

                Bewusst ein Verweis und kein Knopf: der Knopf unten bleibt
                der Hauptweg, dieser hier ist das leisere Angebot. Form wie
                „Mehr über uns“ auf der Startseite („link--iocaste“). */}
            {content.preise_link_label && content.preise_link_url && (
              <p className={styles.preiseLinkZeile}>
                <Link
                  href={content.preise_link_url}
                  className={styles.wellenLink}
                >
                  <span className={styles.wellenLinkText}>
                    {content.preise_link_label}
                  </span>
                  <svg
                    className={styles.wellenLinkGrafik}
                    width="300%"
                    height="12"
                    viewBox="0 0 1200 60"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d="M0,56.5c0,0,298.666,0,399.333,0C448.336,56.5,513.994,46,597,46c77.327,0,135,10.5,200.999,10.5c95.996,0,402.001,0,402.001,0" />
                  </svg>
                </Link>
              </p>
            )}
          </div>
        </section>
      )}

      {/* LEISTUNGEN — was für das Geld dabei ist, mit Symbolen. */}
      {content.leistungen_titel && (
        <section className={styles.leistungen}>
          <div className={styles.inner}>
            <h2 className={styles.abschnittTitel}>
              {content.leistungen_titel}
            </h2>

            {leistungen.length > 0 && (
              <ul className={styles.leistungsGitter}>
                {leistungen.map((leistung, i) => (
                  <li key={i} className={styles.leistung}>
                    {/* Die Symbole sind Schmuck, kein Inhalt: der
                        Screenreader liest den Text daneben. */}
                    <span className={styles.leistungIcon}>
                      <LucideIcon
                        name={leistung.icon}
                        size={30}
                        strokeWidth={1.5}
                        aria-hidden
                      />
                    </span>
                    <span className={styles.leistungTitel}>
                      {leistung.titel}
                    </span>
                    {leistung.text && (
                      <span className={styles.leistungText}>
                        {leistung.text}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* STUDIO — dunkles Band als Bruch, wie der Zuruf auf der Startseite.
          Der Film kommt hier hinein, sobald er aufgenommen ist; fehlt die
          Playback-ID, bleibt der Abschnitt trotzdem stehen. */}
      {content.studio_titel && (
        <section className={styles.studio}>
          <div className={styles.inner}>
            <h2 className={styles.studioTitel}>{content.studio_titel}</h2>

            {studioHtml && (
              <div
                className={styles.studioText}
                dangerouslySetInnerHTML={{ __html: studioHtml }}
              />
            )}

            {content.studio_video_playback_id && (
              <div className={styles.videoRahmen}>
                <ConditionalMuxVideo>
                  <MuxVideoEmbed
                    playbackId={content.studio_video_playback_id}
                    thumbnailTime={content.studio_video_thumbnail_time}
                    autoPlay={false}
                    muted={false}
                  />
                </ConditionalMuxVideo>
              </div>
            )}
          </div>
        </section>
      )}

      {/* WEB UND APP — statt zweier Symbole steht hier das App-Zeichen
          selbst, darunter die beiden Ladenschilder. Wer bis hierher liest,
          überlegt schon mitzumachen; die App gleich ausprobieren zu können
          passt an dieser Stelle besser als eine weitere Aufzählung. */}
      {content.plattformen_titel && (
        <section className={styles.plattformen}>
          <div className={styles.innerSchmal}>
            {content.app_icon?.id && (
              <Image
                src={assetUrl(content.app_icon) ?? ""}
                alt=""
                aria-hidden="true"
                width={content.app_icon.width ?? 128}
                height={content.app_icon.height ?? 128}
                sizes="88px"
                className={styles.appIcon}
              />
            )}
            <h2 className={styles.abschnittTitel}>
              {content.plattformen_titel}
            </h2>
            {plattformenHtml && (
              <div
                className={styles.abschnittIntro}
                dangerouslySetInnerHTML={{ __html: plattformenHtml }}
              />
            )}

            <div className={styles.storeBadges}>
              <a
                href={GOOGLE_PLAY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.storeBadge}
                aria-label="Fairführer bei Google Play öffnen"
              >
                <Image
                  src={googlePlayBadge}
                  alt="Google Play"
                  unoptimized
                  className={styles.storeBadgeImg}
                />
              </a>
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.storeBadge}
                aria-label="Fairführer im App Store öffnen"
              >
                <Image
                  src={appStoreBadge}
                  alt="App Store"
                  unoptimized
                  className={styles.storeBadgeImg}
                />
              </a>
            </div>
          </div>
        </section>
      )}

      {/* AUFNAHMEKRITERIEN — ersetzt die Unterseite /voraussetzungen, die
          per Weiterleitung auf diesen Anker zeigt. */}
      {content.kriterien_titel && (
        <section className={styles.kriterien} id="kriterien">
          <div className={styles.inner}>
            <h2 className={styles.abschnittTitel}>{content.kriterien_titel}</h2>

            {kriterienIntroHtml && (
              <div
                className={styles.abschnittIntro}
                dangerouslySetInnerHTML={{ __html: kriterienIntroHtml }}
              />
            )}

            {kriterienGruppen.length > 0 && (
              <div className={styles.kriterienGitter}>
                {kriterienGruppen.map((gruppe, i) => (
                  <div key={i} className={styles.kriterienKarte}>
                    <span className={styles.kriterienIcon}>
                      <LucideIcon
                        name={gruppe.icon}
                        size={28}
                        strokeWidth={1.5}
                        aria-hidden
                      />
                    </span>
                    <h3 className={styles.kriterienTitel}>{gruppe.titel}</h3>
                    {kriterienHtml[i] && (
                      <div
                        className={styles.kriterienText}
                        dangerouslySetInnerHTML={{ __html: kriterienHtml[i] }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* SCHLUSS — Knopf und der Hinweis, wer die Zahlung abwickelt. */}
      {content.cta_titel && (
        <section className={styles.cta}>
          <div className={styles.innerSchmal}>
            <h2 className={styles.ctaTitel}>{content.cta_titel}</h2>
            {content.cta_text && (
              <p className={styles.ctaText}>{content.cta_text}</p>
            )}

            {content.cta_button_label && content.cta_button_url && (
              <Link
                href={content.cta_button_url}
                className={styles.ctaButton}
              >
                <span className={styles.ctaButtonText}>
                  {content.cta_button_label}
                </span>
              </Link>
            )}

            {content.zahlung_hinweis && (
              <div className={styles.zahlung}>
                {/* Das Logo kommt aus Directus, damit Bogusław es ohne
                    Codeänderung austauschen kann. Fehlt es, bleibt der
                    Hinweistext trotzdem stehen. */}
                {content.zahlung_logo?.id && (
                  <Image
                    src={assetUrl(content.zahlung_logo) ?? ""}
                    alt="PayPal"
                    width={content.zahlung_logo.width ?? 200}
                    height={content.zahlung_logo.height ?? 60}
                    sizes="120px"
                    className={styles.paypalLogo}
                  />
                )}
                <p className={styles.zahlungText}>{content.zahlung_hinweis}</p>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
