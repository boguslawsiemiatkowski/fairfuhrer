// Rozwinięty plik z Directusa (obraz) — id + modified_on do cache-bustingu URL.
//
// width/height pochodzą z metadanych pliku w Directusie i są potrzebne dla
// `next/image` (bez wymiarów komponent nie zadziała, a wpisywanie ich na
// sztywno rozjechałoby się po podmianie obrazu w CMS). Opcjonalne, bo nie
// każde zapytanie o nie prosi, a pliki inne niż obrazy ich nie mają.
export interface DirectusFileRef {
  id: string;
  modified_on?: string | null;
  width?: number | null;
  height?: number | null;
}

// Ein Ort aus der Kollektion `Orte`, so weit aufgelöst, wie das Hero der
// Startseite ihn braucht: Audio, Titelbild samt Maßen und die erste Kategorie
// (sie gibt die Farbe der Überlagerung).
//
// Audio liegt in zwei Formen vor — neuere Pins verweisen über `Audio` auf eine
// Directus-Datei, ältere über `Audio_Datei` auf einen Pfad im Supabase
// Storage. Beide Wege müssen bedient werden; `lib/orte.ts` hat dafür
// `audioUrlFor()`.
export interface HeroAudiopin {
  id: number;
  Name?: string | null;
  Stadt?: string | null;
  Land?: string | null;
  slug?: string | null;
  Audio?: string | null;
  Audio_Datei?: string | null;
  Titelbild?: DirectusFileRef | null;
  Hauptbild?: string | null;
  Kategorie?: { Kategorie_id?: HeroAudiopinKategorie | null }[] | null;
}

export interface HeroAudiopinKategorie {
  id: number;
  Name?: string | null;
  Farbe?: string | null;
}

/** Eine Preisstufe auf der Partnerseite. Die Beträge stehen als Text in
 *  Directus, damit „59,50 €“ genau so erscheint, wie es gemeint ist.
 *  ⚠ Sie müssen zu den PayPal-Plänen passen — eine Änderung in Directus
 *  ändert NICHT, was PayPal abbucht. */
export interface PreisStufe {
  titel?: string;
  zielgruppe?: string;
  preis_netto?: string;
  preis_brutto?: string;
  hervorheben?: boolean;
}

/** Eine Leistung bzw. Kriteriengruppe: Lucide-Name + Text. */
export interface PartnerLeistung {
  icon?: string;
  titel?: string;
  text?: string;
}

/** Inhalte der neuen Partnerseite (Sammlung `partner_werden_content`).
 *  Löst `PartnerPageContent` ab; jene Sammlung ist in Directus als
 *  veraltet markiert und versorgt nur noch die alte Seite. */
export interface PartnerWerdenContent {
  id: number;
  hero_titel?: string;
  hero_text?: string;
  // Logo der Seenergien GmbH unter dem Einleitungstext — wer hinter dem
  // Fairführer steht. Fehlt es, entfällt nur das Bild.
  seenergien_logo?: DirectusFileRef | null;
  // Preise — ⚠ `preise_titel` leer = der ganze Abschnitt entfällt.
  preise_titel?: string;
  preise_intro?: string;
  preise_stufen?: PreisStufe[] | null;
  preise_keine_verlaengerung?: string;
  preise_steuerhinweis?: string;
  // Zweiter, leiserer Weg zur Anmeldung direkt bei den Preisen.
  // Beide Felder müssen gefüllt sein, sonst entfällt der Verweis.
  preise_link_label?: string;
  preise_link_url?: string;
  // Leistungen mit Symbolen
  leistungen_titel?: string;
  leistungen?: PartnerLeistung[] | null;
  // Studio samt Film
  studio_titel?: string;
  studio_text?: string;
  studio_video_playback_id?: string;
  studio_video_thumbnail_time?: number;
  // Web und App — das App-Zeichen steht über der Überschrift, die beiden
  // Ladenschilder darunter (Adressen stehen im Code, nicht in Directus).
  plattformen_titel?: string;
  plattformen_text?: string;
  app_icon?: DirectusFileRef | null;
  // Aufnahmekriterien — ersetzt die Unterseite /voraussetzungen
  kriterien_titel?: string;
  kriterien_intro?: string;
  kriterien_gruppen?: PartnerLeistung[] | null;
  // Schluss: Knopf und PayPal-Hinweis
  cta_titel?: string;
  cta_text?: string;
  cta_button_label?: string;
  cta_button_url?: string;
  zahlung_hinweis?: string;
  // Logo des Zahlungsdienstes. Fehlt es, bleibt nur der Hinweistext.
  zahlung_logo?: DirectusFileRef | null;
}

export interface UeberUnsProzess {
  id: number;
  status: "published" | "draft" | "archived";
  sort: number | null;
  label?: string;
  icon?: string;
}

export interface UeberUnsWert {
  id: number;
  status: "published" | "draft" | "archived";
  sort: number | null;
  icon?: string;
  title?: string;
  text?: string;
}

export interface UeberUnsContent {
  id: number;
  // Hero
  hero_title?: string;
  hero_title_color?: string;
  hero_title_font_size?: string;
  hero_intro?: string;
  hero_intro_color?: string;
  hero_intro_font_size?: string;
  hero_image?: string;
  hero_background_color?: string;
  // Seenergien
  seenergien_text?: string;
  seenergien_text_color?: string;
  seenergien_text_font_size?: string;
  seenergien_image?: string;
  seenergien_background_color?: string;
  // Audioguide
  audioguide_title?: string;
  audioguide_title_color?: string;
  audioguide_title_font_size?: string;
  audioguide_text?: string;
  audioguide_text_color?: string;
  audioguide_text_font_size?: string;
  audioguide_image?: string;
  audioguide_background_color?: string;
  // Handarbeit
  handarbeit_text?: string;
  handarbeit_text_color?: string;
  handarbeit_text_font_size?: string;
  handarbeit_image?: string;
  handarbeit_background_color?: string;
  // Wächst + Prozess
  wachst_title?: string;
  wachst_title_color?: string;
  wachst_title_font_size?: string;
  wachst_text?: string;
  wachst_text_color?: string;
  wachst_text_font_size?: string;
  wachst_image?: string;
  wachst_background_color?: string;
  prozess_items?: UeberUnsProzess[];
  prozess_label_color?: string;
  prozess_label_font_size?: string;
  // Werte
  werte_title?: string;
  werte_title_color?: string;
  werte_title_font_size?: string;
  werte_background_color?: string;
  werte_items?: UeberUnsWert[];
  werte_card_title_color?: string;
  werte_card_title_font_size?: string;
  werte_card_text_color?: string;
  werte_card_text_font_size?: string;
  // Abschluss
  abschluss_text?: string;
  abschluss_text_color?: string;
  abschluss_text_font_size?: string;
  abschluss_background_color?: string;
}

/** Ein Vorteil im Partner-Abschnitt der Startseite: Lucide-Name + Text.
 *  Beide Felder sind optional, weil Directus eine Zeile auch halb
 *  ausgefüllt speichern kann. */
export interface PartnerVorteil {
  icon?: string;
  text?: string;
}

export interface HomePageContent {
  id: number;
  // Globalny kolor linków (Markdown-Links) dla całej strony głównej
  link_color?: string;
  hero_title?: string;
  hero_title_font_size?: string;
  hero_title_color?: string;
  hero_title_mobile_font_size?: string;
  hero_title_mobile_color?: string;
  hero_subtitle?: string;
  hero_subtitle_font_size?: string;
  hero_subtitle_color?: string;
  hero_button_text?: string;
  hero_button_link?: string;
  hero_button_color?: string;
  hero_button_font_size?: string;
  hero_button_background_color?: string;
  hero_button_mobile_font_size?: string;
  hero_button_mobile_color?: string;
  hero_button_background_color_mobile?: string;
  hero_image?: string;
  hero_background_color?: string;
  badges_label?: string;
  badges_label_font_size?: string;
  badges_label_color?: string;
  section2_background_color?: string;
  section2_title?: string;
  section2_title_font_size?: string;
  section2_title_color?: string;
  section2_title_mobile_font_size?: string;
  category_name_font_size?: string;
  category_name_color?: string;
  category_name_mobile_font_size?: string;
  // Sekcja 3 — tła podsekcji: górna (Traveler) i dolna (Partner)
  traveler_background_color?: string;
  section3_title?: string;
  section3_title_font_size?: string;
  section3_title_color?: string;
  section3_title_mobile_font_size?: string;
  section3_text?: string;
  section3_button_text?: string;
  section3_button_color?: string;
  section3_button_font_size?: string;
  section3_button_background_color?: string;
  section4_background_color?: string;
  section4_badge_text?: string;
  section4_title?: string;
  section4_title_font_size?: string;
  section4_title_color?: string;
  section4_title_mobile_font_size?: string;
  section4_text?: string;
  section4_text_font_size?: string;
  section4_text_color?: string;
  section4_text_mobile_font_size?: string;
  section4_button_text?: string;
  section4_button_link?: string;
  section4_button_color?: string;
  section4_button_font_size?: string;
  section4_button_background_color?: string;
  section4_button_mobile_font_size?: string;
  // Audiopin im Hero: Relation auf die Kollektion `Orte`. Die Redaktion wählt
  // ihn selbst aus, statt ihn auszulosen — zwei Gründe:
  //   1. bei einigen älteren Pins fehlt die Audiodatei; ein Zufallstreffer
  //      würde an der sichtbarsten Stelle der Website ins Leere spielen,
  //   2. dieser Platz soll später Teil des Premium-Pakets werden, also muss
  //      er sich gezielt vergeben lassen.
  // Leer oder ohne Audio: das Hero fällt auf das statische Bild zurück.
  hero_audiopin?: HeroAudiopin | null;
  traveler_title?: string;
  traveler_content?: string;
  // Tekst „Vision" wyświetlany POD zdjęciem (nie w kolumnie tekstu) — Markdown
  traveler_vision?: string;
  traveler_cta_label?: string;
  traveler_cta_url?: string;
  traveler_image?: DirectusFileRef | null;
  partner_title?: string;
  partner_content?: string;
  partner_cta_label?: string;
  partner_cta_url?: string;
  partner_image?: DirectusFileRef | null;
  // Tło drugiego bloku (Partner) w sekcji 3 — pusty = fallback #F7F4F0
  partner_background_color?: string;
  // Fairführer-Video (zastępuje starą sekcję 4 "Unterstütze unsere Mission")
  video_mux_playback_id?: string;
  // Sekunde des Video-Frames, den Mux als Vorschaubild (Poster) nutzt.
  // Leer = Mux-Standard (Videomitte).
  video_thumbnail_time?: number;
  video_title?: string;
  video_background_color?: string;
  video_text?: string;
  video_feature_list?: string;
  video_feature_list_background_color?: string;
  // Zuruf unter den Kategorie-Karten: `slogan_01` ist die Aufforderung,
  // `slogan_02` der Satz darunter. Fehlt `slogan_01`, entfällt der ganze
  // Abschnitt — ein dunkles Band ohne Überschrift wäre sinnlos.
  slogan_01?: string;
  slogan_02?: string;
  // Zeichen unter dem Zuruf: der Kartenstift mit kleinem Abspielsymbol,
  // transparentes PNG. Fehlt es, entfällt nur das Bild, nicht der Abschnitt.
  app_icon?: DirectusFileRef | null;
  // Abschnitt „Zwei Wege“: links die Liste, rechts die Karte. Fehlt
  // `zwei_wege_titel`, entfällt der ganze Abschnitt.
  zwei_wege_titel?: string;
  liste_titel?: string;
  liste_text?: string;
  liste_bild?: DirectusFileRef | null;
  karte_titel?: string;
  karte_text?: string;
  karte_bild?: DirectusFileRef | null;
  // Was beide Wege können (Routenplaner, Filter …) — Markdown.
  zwei_wege_features?: string;
  // Überschrift über dem Film im selben Abschnitt. Fehlt sie, entfällt der
  // App-Hinweis samt Film, auch wenn eine Playback-ID gesetzt ist.
  app_hinweis_titel?: string;
  // Mission-Block unter dem Film. Löst den früheren `traveler_*`-Block ab:
  // dort standen gut 1000 Zeichen Fließtext, der auf die Startseite geraten
  // war. Die lange Fassung steht auf /ueber-uns, hier nur der Kern.
  // Fehlt `mission_titel`, entfällt der ganze Block.
  mission_titel?: string;
  mission_text?: string;
  mission_bild?: DirectusFileRef | null;
  mission_cta_label?: string;
  mission_cta_url?: string;
  // Partner-Abschnitt am Seitenende (dunkles Band). Fehlt `partner_cta_titel`,
  // entfällt der ganze Abschnitt.
  partner_cta_titel?: string;
  partner_cta_text?: string;
  partner_cta_vorteile?: PartnerVorteil[] | null;
  partner_cta_button_label?: string;
  partner_cta_button_url?: string;
  video_button_label?: string;
  video_button_url?: string;
}

export interface ContactFormContent {
  id: string;
  background_color?: string;
  title?: string;
  title_font_size?: string;
  title_color?: string;
  email?: string;
  email_description?: string;
  email_description_font_size?: string;
  email_description_color?: string;
  adresse?: string;
  contact_fields_font_size?: string;
  contact_fields_color?: string;
}

export interface PremiumPageContent {
  id: number;
  title?: string;
  lead_text?: string;
  pro_active_title?: string;
  pro_active_date_label?: string;
  pro_active_hint?: string;
  comparison_title?: string;
  comparison_th_feature?: string;
  comparison_th_free?: string;
  comparison_th_pro?: string;
  app_box_title?: string;
  app_box_text?: string;
  app_box_steps?: { step: string }[];
  app_box_note?: string;
}

export interface PremiumComparisonFeature {
  id: number;
  status: "published" | "draft" | "archived";
  sort: number | null;
  feature: string;
  free: boolean;
  pro: boolean;
}

export interface RegisterPageContent {
  id: number;
  title?: string;
  subtitle?: string;
  reisender_title?: string;
  reisender_desc?: string;
  reisender_cta?: string;
  partner_title?: string;
  partner_desc?: string;
  partner_cta?: string;
  login_prompt?: string;
  login_link_text?: string;
}

export interface RedaktionPageContent {
  id: number;
  title?: string;
  subtitle?: string;
  label_name?: string;
  label_adresse?: string;
  label_stadt?: string;
  label_land?: string;
  label_beschreibung?: string;
  hint_beschreibung_audio?: string;
  label_titelbild?: string;
  label_audio?: string;
  label_galerie?: string;
  hint_moderation?: string;
  button_text?: string;
  button_sending_text?: string;
  success_message?: string;
  error_message?: string;
}

export interface AccountContactFormContent {
  id: number;
  title?: string;
  lead_text?: string;
  label_absender?: string;
  label_betreff?: string;
  label_nachricht?: string;
  button_text?: string;
  button_sending_text?: string;
  success_message?: string;
  error_message?: string;
  validation_message?: string;
}
