import { z } from "zod";

/** Maksymalna długość opisu pina (zgodna z komunikatami w UI). */
export const MAX_BESCHREIBUNG = 2000;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const uuidSchema = z
  .string()
  .trim()
  .regex(UUID_REGEX, "Ungültige Datei-ID (UUID erforderlich).");

export const geoPointSchema = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([
    z.number().min(-180).max(180), // longitude
    z.number().min(-90).max(90), // latitude
  ]),
});

/**
 * Schemat dla POST /api/audiopin (tworzenie pina przez partnera).
 */
export const createAudiopinSchema = z.object({
  Name: z
    .string({ error: "Name, Adresse und Stadt sind erforderlich." })
    .trim()
    .min(1, "Name, Adresse und Stadt sind erforderlich.")
    .max(200, "Der Name darf höchstens 200 Zeichen lang sein."),
  Adresse: z
    .string({ error: "Name, Adresse und Stadt sind erforderlich." })
    .trim()
    .min(1, "Name, Adresse und Stadt sind erforderlich.")
    .max(300, "Die Adresse darf höchstens 300 Zeichen lang sein."),
  Stadt: z
    .string({ error: "Name, Adresse und Stadt sind erforderlich." })
    .trim()
    .min(1, "Name, Adresse und Stadt sind erforderlich.")
    .max(120, "Die Stadt darf höchstens 120 Zeichen lang sein."),
  Land: z.string().trim().max(120).nullish(),
  Telefon: z.string().trim().max(80).nullish(),
  Vollbeschreibung: z
    .string()
    .max(
      MAX_BESCHREIBUNG,
      `Die Beschreibung darf höchstens ${MAX_BESCHREIBUNG} Zeichen lang sein.`
    )
    .nullish(),
  Link_URL: z.string().trim().max(500).nullish(),
  Breite: z.number().min(-90).max(90).nullish(),
  Lange: z.number().min(-180).max(180).nullish(),
  Titelbild: uuidSchema.nullish(),
  Audio: uuidSchema.nullish(),
  Galerie: z.array(uuidSchema).max(6, "Maximal 6 Galeriebilder erlaubt.").optional(),
  Kategorie: z.array(z.number().int().positive()).max(10).optional(),
  Zertifizierungen: z.array(uuidSchema).max(20).optional(),
});

/**
 * Schemat dla PATCH /api/audiopin/[id] (edycja pina przez partnera premium).
 */
export const patchAudiopinSchema = z.object({
  Name: z.string().trim().min(1).max(200).optional(),
  Adresse: z.string().trim().min(1).max(300).optional(),
  Stadt: z.string().trim().min(1).max(120).optional(),
  Land: z.string().trim().max(120).nullish(),
  Telefon: z.string().trim().max(80).nullish(),
  Vollbeschreibung: z
    .string()
    .max(
      MAX_BESCHREIBUNG,
      `Die Beschreibung darf höchstens ${MAX_BESCHREIBUNG} Zeichen lang sein.`
    )
    .nullish(),
  Link_URL: z.string().trim().max(500).nullish(),
  Titelbild: uuidSchema.nullish(),
  Audio: uuidSchema.nullish(),
  location: geoPointSchema.nullish(),
  Kategorie: z.array(z.number().int().positive()).max(10).optional(),
  Kategorie_delete: z.array(z.union([z.number(), z.string()])).optional(),
  Zertifizierungen: z.array(uuidSchema).max(20).optional(),
  Zertifizierungen_delete: z.array(z.union([z.number(), z.string()])).optional(),
  Galerie_add: z.array(uuidSchema).max(6).optional(),
  Galerie_delete: z.array(z.coerce.number().int().positive()).optional(),
});

/**
 * Schemat dla POST /api/redaktion (zgłoszenie pina Sehenswertes przez Reisender/Partner).
 */
export const createRedaktionSchema = z.object({
  Name: z
    .string({ error: "Name, Adresse und Stadt sind erforderlich." })
    .trim()
    .min(1, "Name, Adresse und Stadt sind erforderlich.")
    .max(200, "Der Name darf höchstens 200 Zeichen lang sein."),
  Adresse: z
    .string({ error: "Name, Adresse und Stadt sind erforderlich." })
    .trim()
    .min(1, "Name, Adresse und Stadt sind erforderlich.")
    .max(300, "Die Adresse darf höchstens 300 Zeichen lang sein."),
  Stadt: z
    .string({ error: "Name, Adresse und Stadt sind erforderlich." })
    .trim()
    .min(1, "Name, Adresse und Stadt sind erforderlich.")
    .max(120, "Die Stadt darf höchstens 120 Zeichen lang sein."),
  Land: z.string().trim().max(120).nullish(),
  Vollbeschreibung: z
    .string()
    .max(
      MAX_BESCHREIBUNG,
      `Die Beschreibung darf höchstens ${MAX_BESCHREIBUNG} Zeichen lang sein.`
    )
    .nullish(),
  Breite: z.number().min(-90).max(90).nullish(),
  Lange: z.number().min(-180).max(180).nullish(),
  Titelbild: uuidSchema.nullish(),
  Audio: uuidSchema.nullish(),
  Galerie: z.array(uuidSchema).max(6, "Maximal 6 Galeriebilder erlaubt.").optional(),
});

/**
 * Schemat dla POST /api/contact (publiczny formularz kontaktowy z Turnstile).
 */
export const contactFormSchema = z.object({
  name: z
    .string({ error: "Alle Felder sind erforderlich" })
    .trim()
    .min(1, "Alle Felder sind erforderlich")
    .max(150),
  email: z
    .string({ error: "Alle Felder sind erforderlich" })
    .trim()
    .email("Ungültige E-Mail-Adresse")
    .max(254),
  subject: z
    .string({ error: "Alle Felder sind erforderlich" })
    .trim()
    .min(1, "Alle Felder sind erforderlich")
    .max(200),
  message: z
    .string({ error: "Alle Felder sind erforderlich" })
    .trim()
    .min(1, "Alle Felder sind erforderlich")
    .max(5000),
  turnstileToken: z
    .string({ error: "Bitte bestätigen Sie, dass Sie kein Roboter sind" })
    .trim()
    .min(1, "Bitte bestätigen Sie, dass Sie kein Roboter sind"),
});

/**
 * Schemat dla POST /api/account-contact (formularz kontaktowy zalogowanego użytkownika).
 */
export const accountContactSchema = z.object({
  subject: z
    .string({ error: "Betreff und Nachricht sind erforderlich." })
    .trim()
    .min(1, "Betreff und Nachricht sind erforderlich.")
    .max(200),
  message: z
    .string({ error: "Betreff und Nachricht sind erforderlich." })
    .trim()
    .min(1, "Betreff und Nachricht sind erforderlich.")
    .max(5000),
});

/**
 * Schemat dla POST /api/partner/set-vat-id (ustawienie numeru VAT UE partnera).
 */
export const setVatIdSchema = z.object({
  vat_id: z
    .string({ error: "USt-IdNr. ist erforderlich." })
    .trim()
    .min(4, "USt-IdNr. ist erforderlich.")
    .max(20, "Ungültiges USt-IdNr.-Format.")
    .regex(/^[A-Z]{2}[A-Z0-9+\-*.\s]{2,18}$/i, "Ungültiges USt-IdNr.-Format."),
});

/**
 * Zwraca pierwszy czytelny komunikat błędu z obiektu ZodError.
 */
export function firstZodError(error: z.ZodError, fallback = "Ungültige Eingabedaten."): string {
  return error.issues[0]?.message || fallback;
}

