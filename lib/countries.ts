export type TaxGroup = "DE" | "EU" | "EEA_NON_EU" | "SPECIAL" | "THIRD";

export type TaxBucket =
  | "de"
  | "eu_reverse_charge"
  | "eu_no_vat"
  | "third_country";

export type TaxIdFieldKey =
  | "steuernummer"
  | "eu_vat_id"
  | "uid_number"
  | "foreign_tax_id";

export interface Country {
  code: string;
  label: string;
  taxGroup: TaxGroup;
  taxIdFieldKey: TaxIdFieldKey;
  taxIdLabel: string;
  taxIdPlaceholder: string;
  taxIdRequired: boolean;
  hasEuVatOption: boolean;
}

export const COUNTRIES: Country[] = [
  // ── Deutschland ───────────────────────────────────────────────
  {
    code: "DE",
    label: "Deutschland",
    taxGroup: "DE",
    taxIdFieldKey: "steuernummer",
    taxIdLabel: "Steuernummer",
    taxIdPlaceholder: "z.B. 12/345/67890",
    taxIdRequired: true,
    hasEuVatOption: false,
  },

  // ── EU (ohne DE) ─────────────────────────────────────────────
  {
    code: "BE",
    label: "Belgien",
    taxGroup: "EU",
    taxIdFieldKey: "eu_vat_id",
    taxIdLabel: "EU-USt-IdNr.",
    taxIdPlaceholder: "z.B. BE0123456789",
    taxIdRequired: false,
    hasEuVatOption: true,
  },
  {
    code: "DK",
    label: "Dänemark",
    taxGroup: "EU",
    taxIdFieldKey: "eu_vat_id",
    taxIdLabel: "EU-USt-IdNr.",
    taxIdPlaceholder: "z.B. DK12345678",
    taxIdRequired: false,
    hasEuVatOption: true,
  },
  {
    code: "FR",
    label: "Frankreich",
    taxGroup: "EU",
    taxIdFieldKey: "eu_vat_id",
    taxIdLabel: "EU-USt-IdNr.",
    taxIdPlaceholder: "z.B. FRXX123456789",
    taxIdRequired: false,
    hasEuVatOption: true,
  },
  {
    code: "IT",
    label: "Italien",
    taxGroup: "EU",
    taxIdFieldKey: "eu_vat_id",
    taxIdLabel: "EU-USt-IdNr.",
    taxIdPlaceholder: "z.B. IT12345678901",
    taxIdRequired: false,
    hasEuVatOption: true,
  },
  {
    code: "LU",
    label: "Luxemburg",
    taxGroup: "EU",
    taxIdFieldKey: "eu_vat_id",
    taxIdLabel: "EU-USt-IdNr.",
    taxIdPlaceholder: "z.B. LU12345678",
    taxIdRequired: false,
    hasEuVatOption: true,
  },
  {
    code: "NL",
    label: "Niederlande",
    taxGroup: "EU",
    taxIdFieldKey: "eu_vat_id",
    taxIdLabel: "EU-USt-IdNr.",
    taxIdPlaceholder: "z.B. NL123456789B01",
    taxIdRequired: false,
    hasEuVatOption: true,
  },
  {
    code: "AT",
    label: "Österreich",
    taxGroup: "EU",
    taxIdFieldKey: "eu_vat_id",
    taxIdLabel: "EU-USt-IdNr.",
    taxIdPlaceholder: "z.B. ATU12345678",
    taxIdRequired: false,
    hasEuVatOption: true,
  },
  {
    code: "PL",
    label: "Polen",
    taxGroup: "EU",
    taxIdFieldKey: "eu_vat_id",
    taxIdLabel: "EU-USt-IdNr.",
    taxIdPlaceholder: "z.B. PL1234567890",
    taxIdRequired: false,
    hasEuVatOption: true,
  },
  {
    code: "CZ",
    label: "Tschechien",
    taxGroup: "EU",
    taxIdFieldKey: "eu_vat_id",
    taxIdLabel: "EU-USt-IdNr.",
    taxIdPlaceholder: "z.B. CZ12345678",
    taxIdRequired: false,
    hasEuVatOption: true,
  },
  {
    code: "HU",
    label: "Ungarn",
    taxGroup: "EU",
    taxIdFieldKey: "eu_vat_id",
    taxIdLabel: "EU-USt-IdNr.",
    taxIdPlaceholder: "z.B. HU12345678",
    taxIdRequired: false,
    hasEuVatOption: true,
  },

  // ── EWR ohne EU ──────────────────────────────────────────────
  {
    code: "LI",
    label: "Liechtenstein",
    taxGroup: "EEA_NON_EU",
    taxIdFieldKey: "uid_number",
    taxIdLabel: "UID (Liechtenstein)",
    taxIdPlaceholder: "z.B. FL-0001.234.567-8",
    taxIdRequired: false,
    hasEuVatOption: false,
  },

  // ── Sonderfall ───────────────────────────────────────────────
  {
    code: "CH",
    label: "Schweiz",
    taxGroup: "SPECIAL",
    taxIdFieldKey: "uid_number",
    taxIdLabel: "Schweizer UID",
    taxIdPlaceholder: "z.B. CHE-123.456.789",
    taxIdRequired: false,
    hasEuVatOption: false,
  },
];

export function getCountry(code: string | null | undefined): Country | undefined {
  if (!code) return undefined;
  return COUNTRIES.find((c) => c.code === code);
}

export function getCountryLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return COUNTRIES.find((c) => c.code === code)?.label ?? code;
}

export function getTaxBucket(
  countryCode: string | null | undefined,
  hasEuVatId: boolean
): TaxBucket {
  const country = getCountry(countryCode);
  if (!country) return "third_country";
  switch (country.taxGroup) {
    case "DE":
      return "de";
    case "EU":
      return hasEuVatId ? "eu_reverse_charge" : "eu_no_vat";
    case "EEA_NON_EU":
    case "SPECIAL":
    case "THIRD":
      return "third_country";
  }
}
