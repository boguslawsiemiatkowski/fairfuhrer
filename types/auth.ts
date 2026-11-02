export type UserRole = "consumer" | "partner";

export type CompanySize = "nonprofit" | "micro" | "small" | "medium";

export type { TaxBucket, TaxGroup, TaxIdFieldKey } from "@/lib/countries";

export interface Profile {
  id: string;
  role: UserRole;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  premium_until: string | null;
  company_size: CompanySize | null;
  bio: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface PartnerProfile {
  id: string;
  company_name: string | null;
  street: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  website_url: string | null;
  phone_number: string | null;
  business_email: string | null;
  contact_person_name: string | null;
  tax_id: string | null;
  vat_eu: string | null;
  phone_number_2: string | null;
  country_of_registration: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  youtube_url: string | null;
  gallery_paths: string[] | null;
  // VAT / tax fields (new)
  tax_group: import("@/lib/countries").TaxGroup | null;
  tax_bucket: import("@/lib/countries").TaxBucket | null;
  tax_id_field_key: import("@/lib/countries").TaxIdFieldKey | null;
  tax_id_value: string | null;
  no_eu_vat: boolean;
  cross_border_b2c: boolean;
  premium_until?: string | null;
  pin_id?: number | null;
  paypal_subscription_id?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Zwraca aktywną (najpóźniejszą w przyszłości) datę `premium_until` spośród
 * tabel `profiles` i `partner_profiles`. Zapobiega rozjazdowi statusu Premium,
 * gdy tylko jedna z tabel została zaktualizowana (np. ręcznie w bazie lub przez starszy webhook).
 */
export function resolvePremiumUntil(
  profileUntil?: string | null,
  partnerUntil?: string | null,
): string | null {
  const candidates = [profileUntil, partnerUntil].filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0,
  );
  if (candidates.length === 0) return null;

  let bestDate: Date | null = null;
  let bestIso: string | null = null;
  for (const iso of candidates) {
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) {
      if (!bestDate || parsed > bestDate) {
        bestDate = parsed;
        bestIso = iso;
      }
    }
  }
  return bestIso;
}

/**
 * Sprawdza, czy użytkownik lub partner ma aktywne konto Premium (Partner-Pin)
 * w którejkolwiek z tabel (`profiles` lub `partner_profiles`).
 */
export function isPremiumActiveForDates(
  profileUntil?: string | null,
  partnerUntil?: string | null,
  now: Date = new Date(),
): boolean {
  const effective = resolvePremiumUntil(profileUntil, partnerUntil);
  if (!effective) return false;
  return new Date(effective) > now;
}

export interface AuthUser {
  id: string;
  email: string | null;
  profile: Profile | null;
  partnerProfile?: PartnerProfile | null;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterConsumerFormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
}

export interface RegisterPartnerFormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  companyName: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  countryOfRegistration: string;
  phone: string;
  businessEmail: string;
  taxId: string;
  websiteUrl: string;
}

export interface FormErrors {
  [key: string]: string | undefined;
  general?: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  redirectTo?: string;
}

export type OAuthProvider = "google" | "apple" | "facebook" | "twitter" | "spotify";
