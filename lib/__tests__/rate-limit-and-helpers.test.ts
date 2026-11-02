import { beforeEach, describe, expect, it } from "vitest";
import {
  checkRateLimit,
  getClientIp,
  resetRateLimitStore,
} from "@/lib/rate-limit";
import {
  buildCategoriesQueryParam,
  parseCategoriesFromSearch,
} from "@/components/MapWithFilters";
import { sanitizeSavedListeUrl } from "@/components/BackToListeLink";
import { isPremiumActiveForDates, resolvePremiumUntil } from "@/types/auth";
import { parseMapboxSuggestion } from "@/utils/pinFormHelpers";

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it("zezwala na wywołania w ramach limitu i blokuje po jego przekroczeniu", () => {
    const now = 1_000_000;
    const opts = { limit: 3, windowMs: 60_000 };

    expect(checkRateLimit("upload:user-1", opts, now)).toEqual({
      allowed: true,
      remaining: 2,
      retryAfterSeconds: 0,
    });
    expect(checkRateLimit("upload:user-1", opts, now + 1000)).toEqual({
      allowed: true,
      remaining: 1,
      retryAfterSeconds: 0,
    });
    expect(checkRateLimit("upload:user-1", opts, now + 2000)).toEqual({
      allowed: true,
      remaining: 0,
      retryAfterSeconds: 0,
    });

    // 4. próba w tym samym oknie 60 s -> zablokowana
    const blocked = checkRateLimit("upload:user-1", opts, now + 5000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBe(55);
  });

  it("odblokowuje klucz po przesunięciu okna czasowego (sliding window)", () => {
    const now = 1_000_000;
    const opts = { limit: 2, windowMs: 10_000 };

    expect(checkRateLimit("contact:1.2.3.4", opts, now).allowed).toBe(true);
    expect(checkRateLimit("contact:1.2.3.4", opts, now + 5000).allowed).toBe(
      true,
    );
    expect(checkRateLimit("contact:1.2.3.4", opts, now + 6000).allowed).toBe(
      false,
    );

    // Po 10 001 ms pierwsze żądanie wypada z okna, więc kolejne jest dozwolone
    expect(checkRateLimit("contact:1.2.3.4", opts, now + 10_001).allowed).toBe(
      true,
    );
  });

  it("odczytuje IP klienta z nagłówków CF-Connecting-IP oraz X-Forwarded-For", () => {
    const reqCf = new Request("https://fairfuehrer.guide/api/contact", {
      headers: {
        "CF-Connecting-IP": "203.0.113.7",
        "X-Forwarded-For": "198.51.100.1, 10.0.0.1",
      },
    });
    expect(getClientIp(reqCf)).toBe("203.0.113.7");

    const reqXff = new Request("https://fairfuehrer.guide/api/contact", {
      headers: { "X-Forwarded-For": "198.51.100.1, 10.0.0.1" },
    });
    expect(getClientIp(reqXff)).toBe("198.51.100.1");
  });
});

describe("parseMapboxSuggestion", () => {
  it("poprawnie wyciąga ulicę, kod pocztowy, miasto, kraj i współrzędne", () => {
    const parsed = parseMapboxSuggestion({
      place_name: "Münsterplatz 1, 88662 Überlingen, Deutschland",
      text: "Münsterplatz",
      address: "1",
      center: [9.1605, 47.7668],
      context: [
        { id: "postcode.123", text: "88662" },
        { id: "place.456", text: "Überlingen" },
        { id: "country.789", text: "Deutschland" },
      ],
    });

    expect(parsed).toEqual({
      lat: 47.7668,
      lng: 9.1605,
      adresse: "Münsterplatz 1, 88662",
      stadt: "Überlingen",
      land: "Deutschland",
      placeName: "Münsterplatz 1, 88662 Überlingen, Deutschland",
    });
  });
});

describe("URL-Filter für /karte (parseCategoriesFromSearch & buildCategoriesQueryParam)", () => {
  const categories = [
    { id: 1, name: "Sehenswertes", color: "#2d6a4f" },
    { id: 2, name: "Essen & Übernachten", color: "#e76f51" },
    { id: 3, name: "Einkaufen", color: "#2a9d8f" },
  ];

  it("zwraca wszystkie kategorie, gdy brak parametru ?kategorie=", () => {
    expect(parseCategoriesFromSearch("", categories)).toEqual([1, 2, 3]);
    expect(parseCategoriesFromSearch("?foo=bar", categories)).toEqual([
      1, 2, 3,
    ]);
  });

  it("odczytuje wybrane kategorie po slugu lub ID i obsługuje none", () => {
    expect(
      parseCategoriesFromSearch(
        "?kategorie=essen-und-uebernachten,einkaufen",
        categories,
      ),
    ).toEqual([2, 3]);
    expect(parseCategoriesFromSearch("?kategorie=1", categories)).toEqual([1]);
    expect(parseCategoriesFromSearch("?kategorie=none", categories)).toEqual(
      [],
    );
  });

  it("buduje czysty parametr URL lub null gdy wybrane są wszystkie kategorie", () => {
    expect(buildCategoriesQueryParam([1, 2, 3], categories)).toBeNull();
    expect(buildCategoriesQueryParam([], categories)).toBe("none");
    expect(buildCategoriesQueryParam([1, 2], categories)).toBe(
      "sehenswertes,essen-und-uebernachten",
    );
  });
});

describe("resolvePremiumUntil & isPremiumActiveForDates (Partner-Pin Status)", () => {
  const now = new Date("2026-11-02T12:00:00Z");

  it("rozpoznaje aktywne Premium niezależnie od tego, w której tabeli zapisano datę", () => {
    expect(isPremiumActiveForDates("2027-05-01T00:00:00Z", null, now)).toBe(
      true,
    );
    expect(isPremiumActiveForDates(null, "2027-05-01T00:00:00Z", now)).toBe(
      true,
    );
    expect(isPremiumActiveForDates("2025-01-01T00:00:00Z", null, now)).toBe(
      false,
    );
    expect(isPremiumActiveForDates(null, null, now)).toBe(false);
  });

  it("wybiera późniejszą datę wygaśnięcia, gdy obie tabele mają różne daty", () => {
    expect(
      resolvePremiumUntil("2026-01-01T00:00:00Z", "2027-09-15T00:00:00Z"),
    ).toBe("2027-09-15T00:00:00Z");
    expect(
      isPremiumActiveForDates(
        "2026-01-01T00:00:00Z",
        "2027-09-15T00:00:00Z",
        now,
      ),
    ).toBe(true);
  });
});

describe("sanitizeSavedListeUrl (Powrót ze strony Audiopinu do filtrów /liste)", () => {
  it("zachowuje parametry filtrów miasta, kategorii i kraju dla /liste", () => {
    expect(
      sanitizeSavedListeUrl(
        "/liste?stadt=konstanz&kategorie=essen-und-uebernachten",
      ),
    ).toBe("/liste?stadt=konstanz&kategorie=essen-und-uebernachten");
    expect(sanitizeSavedListeUrl("/liste")).toBe("/liste");
  });

  it("odrzuca zewnętrzne lub inne ścieżki i wraca bezpiecznie do /liste", () => {
    expect(sanitizeSavedListeUrl(null)).toBe("/liste");
    expect(sanitizeSavedListeUrl("https://evil.example/liste")).toBe("/liste");
    expect(sanitizeSavedListeUrl("/liste/konstanz/bio-hof")).toBe("/liste");
  });
});



