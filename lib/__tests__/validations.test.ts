import { describe, expect, it } from "vitest";
import {
  accountContactSchema,
  contactFormSchema,
  createAudiopinSchema,
  createRedaktionSchema,
  firstZodError,
  patchAudiopinSchema,
  setVatIdSchema,
} from "@/lib/validations/api";

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

  describe("contactFormSchema & accountContactSchema", () => {
    it("prüft E-Mail-Format und Turnstile-Token beim Kontaktformular", () => {
      const invalidEmail = contactFormSchema.safeParse({
        name: "Max",
        email: "keine-email",
        subject: "Frage",
        message: "Hallo",
        turnstileToken: "token-123",
      });
      expect(invalidEmail.success).toBe(false);
      if (!invalidEmail.success) {
        expect(firstZodError(invalidEmail.error)).toBe(
          "Ungültige E-Mail-Adresse"
        );
      }
    });

    it("lehnt leere Nachrichten bei accountContactSchema ab", () => {
      const emptyMsg = accountContactSchema.safeParse({
        subject: "Hilfe",
        message: "   ",
      });
      expect(emptyMsg.success).toBe(false);
    });
  });

  describe("setVatIdSchema", () => {
    it("akzeptiert gültige EU-USt-IdNr. und lehnt Freitext ab", () => {
      expect(setVatIdSchema.safeParse({ vat_id: "DE123456789" }).success).toBe(
        true
      );
      expect(setVatIdSchema.safeParse({ vat_id: "ATU12345678" }).success).toBe(
        true
      );
      expect(
        setVatIdSchema.safeParse({ vat_id: "<script>alert(1)</script>" })
          .success
      ).toBe(false);
    });
  });
});

