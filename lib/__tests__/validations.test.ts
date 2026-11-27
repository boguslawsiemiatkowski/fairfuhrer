import { describe, expect, it } from "vitest";
import {
  accountContactSchema,
  createAudiopinSchema,
  createRedaktionSchema,
  firstZodError,
  patchAudiopinSchema,
  updateConsumerProfileSchema,
  updatePartnerProfileSchema,
} from "@/lib/validations/api";
import {
  clientEnvSchema,
  directusEnvSchema,
  paypalEnvSchema,
  serverEnvSchema,
} from "@/lib/env";

const VALID_UUID = "739e98a6-b5b7-4ed2-ab94-2eb2f9440104";

describe("API Zod Schemas", () => {
  describe("createAudiopinSchema", () => {
    it("akzeptiert gültige Pin-Daten eines Partners", () => {
      const parsed = createAudiopinSchema.safeParse({
        Name: "  Hofladen Sonnenschein ",
        Adresse: "Hauptstraße 12",
        Stadt: "Überlingen",
        Vollbeschreibung: "<p>Frisches Obst und Gemüse aus der Region.</p>",
        Link_URL: "https://hofladen-sonnenschein.de",
        Breite: 47.766,
        Lange: 9.159,
        Titelbild: VALID_UUID,
        Galerie: [VALID_UUID],
        Kategorie: [2, 3],
        Zertifizierungen: [VALID_UUID],
      });

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.Name).toBe("Hofladen Sonnenschein");
      }
    });

    it("lehnt fehlende Pflichtfelder und zu lange Beschreibungen ab", () => {
      const missingName = createAudiopinSchema.safeParse({
        Name: "   ",
        Adresse: "Hauptstraße 1",
        Stadt: "Konstanz",
      });
      expect(missingName.success).toBe(false);
      if (!missingName.success) {
        expect(firstZodError(missingName.error)).toBe(
          "Name, Adresse und Stadt sind erforderlich."
        );
      }

      const tooLongDesc = createAudiopinSchema.safeParse({
        Name: "Test",
        Adresse: "Hauptstraße 1",
        Stadt: "Konstanz",
        Vollbeschreibung: "a".repeat(2001),
      });
      expect(tooLongDesc.success).toBe(false);
    });

    it("lehnt ungültige UUIDs bei Titelbild oder Audio ab", () => {
      const badUuid = createAudiopinSchema.safeParse({
        Name: "Test",
        Adresse: "Hauptstraße 1",
        Stadt: "Konstanz",
        Titelbild: "../../../items/Orte",
      });
      expect(badUuid.success).toBe(false);
    });
  });

  describe("patchAudiopinSchema", () => {
    it("validiert GeoJSON Point Koordinaten und Galerie-Mutationen", () => {
      const validPatch = patchAudiopinSchema.safeParse({
        Name: "Neuer Name",
        location: {
          type: "Point",
          coordinates: [9.175, 47.66],
        },
        Galerie_add: [VALID_UUID],
        Galerie_delete: [12, "15"],
      });
      expect(validPatch.success).toBe(true);
      if (validPatch.success) {
        expect(validPatch.data.Galerie_delete).toEqual([12, 15]);
      }

      const invalidCoords = patchAudiopinSchema.safeParse({
        location: {
          type: "Point",
          coordinates: [250, 95], // außerhalb [-180..180, -90..90]
        },
      });
      expect(invalidCoords.success).toBe(false);
    });
  });

  describe("createRedaktionSchema", () => {
    it("begrenzt Galerie auf maximal 6 Bilder", () => {
      const tooManyImages = createRedaktionSchema.safeParse({
        Name: "Aussichtspunkt",
        Adresse: "Bergweg 1",
        Stadt: "Füssen",
        Galerie: Array(7).fill(VALID_UUID),
      });
      expect(tooManyImages.success).toBe(false);
    });
  });

  describe("accountContactSchema", () => {
    it("lehnt leere Nachrichten bei accountContactSchema ab", () => {
      const emptyMsg = accountContactSchema.safeParse({
        subject: "Hilfe",
        message: "   ",
      });
      expect(emptyMsg.success).toBe(false);
    });
  });

  describe("updateConsumerProfileSchema & updatePartnerProfileSchema", () => {
    it("akzeptiert erlaubte Profilfelder und lehnt nicht autorisierte Felder (z.B. premium_until, tax_bucket) strikt ab", () => {
      expect(
        updateConsumerProfileSchema.safeParse({
          first_name: "Anna",
          last_name: "Müller",
        }).success
      ).toBe(true);
      expect(
        updateConsumerProfileSchema.safeParse({
          first_name: "Anna",
          premium_until: "2099-01-01T00:00:00Z",
        }).success
      ).toBe(false);

      expect(
        updatePartnerProfileSchema.safeParse({
          company_name: "Biohof Bodensee",
          vat_eu: "ATU12345678",
        }).success
      ).toBe(true);
      expect(
        updatePartnerProfileSchema.safeParse({
          company_name: "Biohof Bodensee",
          tax_bucket: "third_country",
        }).success
      ).toBe(false);
    });
  });

  describe("clientEnvSchema & serverEnvSchema (lib/env.ts)", () => {
    it("waliduje zmienne środowiskowe i usuwa końcowe slashe z adresów URL", () => {
      const validClient = clientEnvSchema.safeParse({
        NEXT_PUBLIC_DIRECTUS_URL: "https://cms.fairfuehrer.guide///",
        NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co/",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_123",
        NEXT_PUBLIC_MAPBOX_TOKEN: "pk.eyJ123",
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4AAA",
      });
      expect(validClient.success).toBe(true);
      if (validClient.success) {
        expect(validClient.data.NEXT_PUBLIC_DIRECTUS_URL).toBe(
          "https://cms.fairfuehrer.guide"
        );
        expect(validClient.data.NEXT_PUBLIC_SUPABASE_URL).toBe(
          "https://abc.supabase.co"
        );
      }

      const missingServerSecret = serverEnvSchema.safeParse({
        NEXT_PUBLIC_DIRECTUS_URL: "https://cms.fairfuehrer.guide",
        NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_123",
        NEXT_PUBLIC_MAPBOX_TOKEN: "pk.eyJ123",
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4AAA",
        DIRECTUS_URL: "https://cms.fairfuehrer.guide",
      });
      expect(missingServerSecret.success).toBe(false);
    });

    it("grupa Directusa NIE wymaga sekretów PayPala ani Supabase", () => {
      // ⚠ To najważniejsza własność podziału na grupy: `lib/directus.ts`
      // importuje 11 stron (główna, /agb, /datenschutz, /impressum …).
      // Gdyby wymagał pełnego zestawu zmiennych, brak sekretu PayPala
      // wywracałby całą witrynę — a strony treściowe o płatnościach nic nie wiedzą.
      const onlyDirectus = directusEnvSchema.safeParse({
        DIRECTUS_URL: "https://cms.fairfuehrer.guide//",
      });
      expect(onlyDirectus.success).toBe(true);
      if (onlyDirectus.success) {
        expect(onlyDirectus.data.DIRECTUS_URL).toBe(
          "https://cms.fairfuehrer.guide"
        );
        // Token jest opcjonalny — treści publiczne czyta polityka publiczna Directusa.
        expect(onlyDirectus.data.DIRECTUS_TOKEN).toBeUndefined();
      }
    });

    it("grupa PayPala wymaga swoich sekretów, ale nie zmiennych Directusa", () => {
      expect(
        paypalEnvSchema.safeParse({ PAYPAL_CLIENT_ID: "abc" }).success
      ).toBe(false);

      const valid = paypalEnvSchema.safeParse({
        PAYPAL_CLIENT_ID: "abc",
        PAYPAL_CLIENT_SECRET: "secret",
      });
      expect(valid.success).toBe(true);
      // Domyślnie sandbox: literówka w PAYPAL_MODE nie może uruchomić prawdziwych płatności.
      if (valid.success) expect(valid.data.PAYPAL_MODE).toBe("sandbox");
    });
  });
});

