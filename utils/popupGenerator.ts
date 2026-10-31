import DOMPurify from "dompurify";
import type { Place } from "../types";
import styles from "../components/MapBoxMap.module.css";
import { categoryColorFor } from "@/components/CategoryIcon";

export function generatePopupHTML(place: Place): string {
  const safeName = DOMPurify.sanitize(place.Name, { ALLOWED_TAGS: [] });
  const cityLine = [place.Stadt, place.Land ? `(${place.Land})` : ""]
    .filter(Boolean)
    .join(" ");
  const safeAddress = DOMPurify.sanitize(
    [place.Adresse, cityLine].filter(Boolean).join(" "),
    { ALLOWED_TAGS: [] },
  );
  const safePhone = place.Telefon
    ? DOMPurify.sanitize(place.Telefon, { ALLOWED_TAGS: [] })
    : "";

  const phoneHTML = safePhone
    ? `<p class="${styles.popupPhone}"><a href="tel:${safePhone}" class="${styles.popupPhoneLink}">📞 ${safePhone}</a></p>`
    : "";

  const categoryBadgesHTML =
    place.Kategorie.length > 0
      ? `<div class="popup-category-badges">${place.Kategorie.map(
          (cat) =>
            `<span class="popup-category-badge" style="background-color:${categoryColorFor(cat)}">${DOMPurify.sanitize(cat.name, { ALLOWED_TAGS: [] })}</span>`,
        ).join("")}</div>`
      : "";

  return DOMPurify.sanitize(
    `<div class="${styles.modernPopup}">
      ${categoryBadgesHTML}
      <h3 class="${styles.popupTitle}">${safeName}</h3>
      <p class="${styles.popupAddress}">📍 ${safeAddress}</p>
      ${phoneHTML}
    </div>`,
    { ADD_ATTR: ["style", "href"] },
  );
}