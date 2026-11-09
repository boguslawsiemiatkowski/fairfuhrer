import DOMPurify from "dompurify";
import type { Place } from "../types";
import styles from "../components/MapBoxMap.module.css";
import { categoryColorFor } from "@/components/CategoryIcon";

// Ścieżki SVG wyekstrahowane z lucide-react (MapPinHouse oraz Phone),
// spójne z systemem ikon w lib/categoryIcons.ts
const LUCIDE_MAP_PIN_HOUSE_SVG = `<svg class="${styles.popupIcon}" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 22a1 1 0 0 1-1-1v-4a1 1 0 0 1 .445-.832l3-2a1 1 0 0 1 1.11 0l3 2A1 1 0 0 1 22 17v4a1 1 0 0 1-1 1z"/><path d="M18 10a8 8 0 0 0-16 0c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 .601.2"/><path d="M18 22v-3"/><circle cx="10" cy="10" r="3"/></svg>`;

const LUCIDE_PHONE_SVG = `<svg class="${styles.popupIcon}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/></svg>`;

export function generatePopupHTML(place: Place): string {
  const safeName = DOMPurify.sanitize(place.Name, { ALLOWED_TAGS: [] });
  const cityLine = [place.Stadt, place.Land ? `(${place.Land})` : ""]
    .filter(Boolean)
    .join(" ");
  const safeAddress = DOMPurify.sanitize(
    [place.Adresse, cityLine].filter(Boolean).join(", "),
    { ALLOWED_TAGS: [] },
  );
  const safePhone = place.Telefon
    ? DOMPurify.sanitize(place.Telefon, { ALLOWED_TAGS: [] })
    : "";
  const safePhoneHref = safePhone.replace(/\s+/g, "");

  const firstCategory = place.Kategorie[0];
  const bgColor = categoryColorFor(firstCategory);
  const hasAudio = Boolean(place.Audio || place.Audio_Datei);

  const phoneHTML = safePhone
    ? `<p class="${styles.popupPhone}"><a href="tel:${safePhoneHref}" class="${styles.popupPhoneLink}">${LUCIDE_PHONE_SVG}<span>${safePhone}</span></a></p>`
    : "";

  const categoryBadges = place.Kategorie.map(
    (cat) =>
      `<span class="popup-category-badge">${DOMPurify.sanitize(cat.name, { ALLOWED_TAGS: [] })}</span>`,
  );

  const badgesHTML =
    categoryBadges.length > 0
      ? `<div class="popup-category-badges">${categoryBadges.join("")}</div>`
      : "";

  const footerLabel = hasAudio
    ? "Details &amp; Audioguide öffnen"
    : "Details öffnen";

  return DOMPurify.sanitize(
    `<div class="${styles.modernPopup}" style="background-color:${bgColor}">
      <div class="${styles.popupBody}">
        ${badgesHTML}
        <h3 class="${styles.popupTitle}">${safeName}</h3>
        <p class="${styles.popupAddress}">${LUCIDE_MAP_PIN_HOUSE_SVG}<span>${safeAddress}</span></p>
        ${phoneHTML}
      </div>
      <div class="${styles.popupFooter}">
        <span>${footerLabel}</span>
        <span>→</span>
      </div>
    </div>`,
    {
      USE_PROFILES: { html: true, svg: true },
      ADD_ATTR: [
        "style",
        "href",
        "viewBox",
        "fill",
        "stroke",
        "stroke-width",
        "stroke-linecap",
        "stroke-linejoin",
        "aria-hidden",
      ],
    },
  );
}
