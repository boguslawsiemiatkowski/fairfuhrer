"use server";

import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  authEmailSchema,
  strongPasswordSchema,
  registerConsumerSchema,
  registerPartnerSchema,
  updateConsumerProfileSchema,
  updatePartnerProfileSchema,
  firstZodError,
} from "@/lib/validations/api";
import type {
  AuthResult,
  AuthUser,
  PartnerProfile,
  Profile,
} from "@/types/auth";
import { getCountry, getTaxBucket } from "@/lib/countries";

async function getRemoteIp(): Promise<string | undefined> {
  const h = await headers();
  const cfIp = h.get("CF-Connecting-IP")?.trim();
  if (cfIp) return cfIp;

  const forwardedFor = h.get("X-Forwarded-For");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  return undefined;
}

function checkAuthActionRateLimit(
  bucketPrefix: string,
  remoteIp: string | undefined,
  limit: number,
  windowMs: number
): AuthResult | null {
  const rl = checkRateLimit(`${bucketPrefix}:${remoteIp ?? "unknown"}`, {
    limit,
    windowMs,
  });
  if (!rl.allowed) {
    return {
      success: false,
      error: `Zu viele Versuche. Bitte warten Sie ${rl.retryAfterSeconds} Sekunden und versuchen Sie es erneut.`,
    };
  }
  return null;
}

export async function loginWithEmail(formData: FormData): Promise<AuthResult> {
  const rawEmail = (formData.get("email") as string) ?? "";
  const password = (formData.get("password") as string) ?? "";
  const turnstileToken = (formData.get("turnstileToken") as string) ?? "";

  if (!rawEmail.trim() || !password) {
    return { success: false, error: "E-Mail und Passwort sind erforderlich." };
  }

  const emailParsed = authEmailSchema.safeParse(rawEmail);
  if (!emailParsed.success) {
    return { success: false, error: firstZodError(emailParsed.error) };
  }
  const email = emailParsed.data;

  const remoteIp = await getRemoteIp();
  const rateLimitError = checkAuthActionRateLimit("auth:login", remoteIp, 15, 15 * 60_000);
  if (rateLimitError) return rateLimitError;

  if (!turnstileToken || !(await verifyTurnstileToken(turnstileToken, remoteIp))) {
    return { success: false, error: "Sicherheitsüberprüfung fehlgeschlagen. Bitte versuchen Sie es erneut." };
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error("loginWithEmail error:", error.message);
    if (error.message.includes("Invalid login credentials")) {
      return { success: false, error: "E-Mail oder Passwort ist falsch." };
    }
    if (error.message.includes("Email not confirmed")) {
      return {
        success: false,
        error: "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.",
      };
    }
    return { success: false, error: "Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut." };
  }

  return { success: true, redirectTo: "/konto" };
}

export async function loginWithMagicLink(
  formData: FormData
): Promise<AuthResult> {
  const rawEmail = (formData.get("email") as string) ?? "";
  const turnstileToken = (formData.get("turnstileToken") as string) ?? "";

  if (!rawEmail.trim()) {
    return { success: false, error: "Bitte geben Sie Ihre E-Mail-Adresse ein." };
  }

  const emailParsed = authEmailSchema.safeParse(rawEmail);
  if (!emailParsed.success) {
    return { success: false, error: firstZodError(emailParsed.error) };
  }
  const email = emailParsed.data;

  const remoteIp = await getRemoteIp();
  const rateLimitError = checkAuthActionRateLimit("auth:magic", remoteIp, 6, 15 * 60_000);
  if (rateLimitError) return rateLimitError;

  if (!turnstileToken || !(await verifyTurnstileToken(turnstileToken, remoteIp))) {
    return { success: false, error: "Sicherheitsüberprüfung fehlgeschlagen. Bitte versuchen Sie es erneut." };
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Nie twórz automatycznie niekompletnego konta (bez roli i username),
      // gdy ktoś wpisze niezarejestrowany e-mail w zakładce Magic Link.
      shouldCreateUser: false,
      emailRedirectTo: `${process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL}/callback`,
    },
  });

  if (error) {
    console.error("loginWithMagicLink error:", error.message);
    if (error.message.includes("Signups not allowed for otp")) {
      return {
        success: false,
        error: "Zu dieser E-Mail-Adresse existiert noch kein Konto. Bitte registrieren Sie sich zuerst.",
      };
    }
    if (error.message.includes("security purposes") || error.status === 429) {
      return {
        success: false,
        error: "Aus Sicherheitsgründen können Sie nur alle 60 Sekunden einen neuen Link anfordern. Bitte warten Sie einen Moment.",
      };
    }
    return { success: false, error: "Magic Link konnte nicht gesendet werden." };
  }

  return {
    success: true,
    error: undefined,
  };
}

export async function resendConfirmation(formData: FormData): Promise<AuthResult> {
  const rawEmail = (formData.get("email") as string) ?? "";
  const turnstileToken = (formData.get("turnstileToken") as string) ?? "";

  if (!rawEmail.trim()) {
    return { success: false, error: "Bitte geben Sie Ihre E-Mail-Adresse ein." };
  }

  const emailParsed = authEmailSchema.safeParse(rawEmail);
  if (!emailParsed.success) {
    return { success: false, error: firstZodError(emailParsed.error) };
  }
  const email = emailParsed.data;

  const remoteIp = await getRemoteIp();
  const rateLimitError = checkAuthActionRateLimit("auth:resend", remoteIp, 6, 15 * 60_000);
  if (rateLimitError) return rateLimitError;

  if (!turnstileToken || !(await verifyTurnstileToken(turnstileToken, remoteIp))) {
    return { success: false, error: "Sicherheitsüberprüfung fehlgeschlagen. Bitte versuchen Sie es erneut." };
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL}/callback`,
    },
  });

  if (error) {
    console.error("resendConfirmation error:", error.message);
    return { success: false, error: "Bestätigungslink konnte nicht gesendet werden." };
  }

  return { success: true, error: undefined };
}

export async function registerConsumer(
  formData: FormData
): Promise<AuthResult> {
  const rawEmail = (formData.get("email") as string) ?? "";
  const password = (formData.get("password") as string) ?? "";
  const confirmPassword = (formData.get("confirmPassword") as string) ?? "";
  const rawUsername = (formData.get("username") as string) ?? "";
  const turnstileToken = (formData.get("turnstileToken") as string) ?? "";

  if (!rawEmail.trim() || !password || !rawUsername.trim()) {
    return { success: false, error: "Alle Pflichtfelder müssen ausgefüllt werden." };
  }

  if (password !== confirmPassword) {
    return { success: false, error: "Die Passwörter stimmen nicht überein." };
  }

  const parsed = registerConsumerSchema.safeParse({
    email: rawEmail,
    username: rawUsername,
    password,
    confirmPassword,
  });
  if (!parsed.success) {
    return { success: false, error: firstZodError(parsed.error) };
  }

  const { email, username } = parsed.data;

  const remoteIp = await getRemoteIp();
  const rateLimitError = checkAuthActionRateLimit("auth:register", remoteIp, 10, 30 * 60_000);
  if (rateLimitError) return rateLimitError;

  if (!turnstileToken || !(await verifyTurnstileToken(turnstileToken, remoteIp))) {
    return { success: false, error: "Sicherheitsüberprüfung fehlgeschlagen. Bitte versuchen Sie es erneut." };
  }

  const supabase = await getSupabaseServerClient();
  const { data: signUpData, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: "consumer",
        username,
      },
      emailRedirectTo: `${process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL}/callback`,
    },
  });

  if (error) {
    console.error("registerConsumer error:", error.message);
    if (error.message.includes("already registered")) {
      return { success: false, error: "Diese E-Mail-Adresse ist bereits registriert." };
    }
    return { success: false, error: "Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut." };
  }

  // Przy włączonym potwierdzaniu e-maili w Supabase signUp dla istniejącego
  // adresu nie zwraca błędu, lecz obiekt user z pustą tablicą `identities: []`.
  if (!signUpData.user?.identities || signUpData.user.identities.length === 0) {
    return { success: false, error: "Diese E-Mail-Adresse ist bereits registriert." };
  }

  return { success: true, redirectTo: "/konto" };
}

export async function registerPartner(formData: FormData): Promise<AuthResult> {
  const rawEmail = (formData.get("email") as string) ?? "";
  const password = (formData.get("password") as string) ?? "";
  const confirmPassword = (formData.get("confirmPassword") as string) ?? "";
  const rawFirstName = (formData.get("firstName") as string) ?? "";
  const rawLastName = (formData.get("lastName") as string) ?? "";
  const rawCompanyName = (formData.get("companyName") as string) ?? "";
  const rawStreet = (formData.get("street") as string) ?? "";
  const rawPostalCode = (formData.get("postalCode") as string) ?? "";
  const rawCity = (formData.get("city") as string) ?? "";
  const rawCountry = (formData.get("country") as string) || "DE";
  const rawBusinessEmail = (formData.get("businessEmail") as string) ?? "";
  const rawPhone = (formData.get("phone") as string) ?? "";
  const rawTaxIdValue = (formData.get("taxIdValue") as string) ?? "";
  const noEuVat = formData.get("noEuVat") === "true";
  const rawWebsiteUrl = (formData.get("websiteUrl") as string) ?? "";
  const turnstileToken = (formData.get("turnstileToken") as string) ?? "";

  if (
    !rawEmail.trim() ||
    !password ||
    !rawFirstName.trim() ||
    !rawLastName.trim() ||
    !rawCompanyName.trim() ||
    !rawStreet.trim() ||
    !rawPostalCode.trim() ||
    !rawCity.trim()
  ) {
    return { success: false, error: "Alle Pflichtfelder müssen ausgefüllt werden." };
  }

  if (password !== confirmPassword) {
    return { success: false, error: "Die Passwörter stimmen nicht überein." };
  }

  const parsed = registerPartnerSchema.safeParse({
    email: rawEmail,
    password,
    confirmPassword,
    firstName: rawFirstName,
    lastName: rawLastName,
    companyName: rawCompanyName,
    street: rawStreet,
    postalCode: rawPostalCode,
    city: rawCity,
    country: rawCountry,
    businessEmail: rawBusinessEmail,
    phone: rawPhone,
    taxIdValue: rawTaxIdValue,
    noEuVat,
    websiteUrl: rawWebsiteUrl,
  });
  if (!parsed.success) {
    return { success: false, error: firstZodError(parsed.error) };
  }

  const {
    email,
    firstName,
    lastName,
    companyName,
    street,
    postalCode,
    city,
    country: countryCode,
    businessEmail,
    phone,
    taxIdValue: trimmedTaxId,
    websiteUrl,
  } = parsed.data;
  const taxIdValue = trimmedTaxId || null;

  const countryMeta = getCountry(countryCode);
  const taxGroup = countryMeta?.taxGroup ?? "THIRD";

  // Serwerowa walidacja wymagalności numeru podatkowego (DE / EU)
  if (taxGroup === "DE" && !taxIdValue) {
    return { success: false, error: "Bitte geben Sie Ihre Steuernummer ein." };
  }
  if (taxGroup === "EU" && !noEuVat && !taxIdValue) {
    return {
      success: false,
      error: "Bitte geben Sie Ihre EU-USt-IdNr. ein oder aktivieren Sie die Checkbox.",
    };
  }

  const remoteIp = await getRemoteIp();
  const rateLimitError = checkAuthActionRateLimit("auth:register-partner", remoteIp, 10, 30 * 60_000);
  if (rateLimitError) return rateLimitError;

  if (!turnstileToken || !(await verifyTurnstileToken(turnstileToken, remoteIp))) {
    return { success: false, error: "Sicherheitsüberprüfung fehlgeschlagen. Bitte versuchen Sie es erneut." };
  }

  const supabase = await getSupabaseServerClient();
  const { data: signUpData, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: "partner",
        first_name: firstName,
        last_name: lastName,
      },
      emailRedirectTo: `${process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL}/callback`,
    },
  });

  if (error) {
    console.error("registerPartner error:", error.message);
    if (error.message.includes("already registered")) {
      return { success: false, error: "Diese E-Mail-Adresse ist bereits registriert." };
    }
    return { success: false, error: "Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut." };
  }

  // Ochrona przed nadpisaniem istniejącego profilu partnera przez supabaseAdmin (service_role):
  // gdy e-mail jest już zarejestrowany w Supabase (przy włączonym potwierdzaniu e-maili),
  // signUp zwraca obiekt user z pustą tablicą `identities: []`. Bez tego sprawdzenia
  // poniższy upsert przez supabaseAdmin nadpisałby dane firmowe istniejącego konta.
  if (!signUpData.user?.identities || signUpData.user.identities.length === 0) {
    return { success: false, error: "Diese E-Mail-Adresse ist bereits registriert." };
  }

  // Zapisz dane firmy do partner_profiles (przez admin client — user nie jest jeszcze zalogowany)
  if (signUpData.user) {
    const hasEuVatId = taxGroup === "EU" && !noEuVat && !!taxIdValue;
    const taxBucket = getTaxBucket(countryCode, hasEuVatId);
    const crossBorderB2c = taxBucket === "eu_no_vat";

    // Mapuj tax_id_value na właściwe pole legacy (vat_eu lub tax_id)
    const vatEu = taxGroup === "EU" && !noEuVat ? taxIdValue : null;
    const taxId = taxGroup === "DE" ? taxIdValue : null;

    const { error: upsertError } = await supabaseAdmin.from("partner_profiles").upsert({
      id: signUpData.user.id,
      company_name: companyName,
      street,
      postal_code: postalCode,
      city,
      country: countryCode,
      business_email: businessEmail || null,
      phone_number: phone || null,
      tax_id: taxId,
      vat_eu: vatEu,
      website_url: websiteUrl || null,
      // nowe kolumny VAT
      tax_group: taxGroup,
      tax_bucket: taxBucket,
      tax_id_field_key: countryMeta?.taxIdFieldKey ?? "foreign_tax_id",
      tax_id_value: taxIdValue,
      no_eu_vat: noEuVat,
      cross_border_b2c: crossBorderB2c,
    });
    if (upsertError) {
      console.error("registerPartner upsert error:", upsertError.message);
    }
  }

  return { success: true, redirectTo: "/konto/partner" };
}

export async function deleteAccount(): Promise<AuthResult> {
  const supabase = await getSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { success: false, error: "Nicht autorisiert." };
  }

  // Usuń usera z Auth (cascade usunie profiles i partner_profiles)
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("deleteAccount error:", deleteError.message);
    return { success: false, error: "Konto konnte nicht gelöscht werden." };
  }

  // Wyczyść ciasteczka sesji w przeglądarce po usunięciu konta
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});

  return { success: true };
}

export async function logout(): Promise<void> {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}

export async function resetPassword(
  emailOrFormData: string | FormData,
  turnstileTokenArg?: string
): Promise<AuthResult> {
  const rawEmail =
    typeof emailOrFormData === "string"
      ? emailOrFormData
      : ((emailOrFormData.get("email") as string) ?? "");
  const turnstileToken =
    typeof emailOrFormData === "string"
      ? (turnstileTokenArg ?? "")
      : ((emailOrFormData.get("turnstileToken") as string) ?? "");

  if (!rawEmail.trim()) {
    return { success: false, error: "Bitte geben Sie Ihre E-Mail-Adresse ein." };
  }

  const emailParsed = authEmailSchema.safeParse(rawEmail);
  if (!emailParsed.success) {
    return { success: false, error: firstZodError(emailParsed.error) };
  }
  const email = emailParsed.data;

  const remoteIp = await getRemoteIp();
  const rateLimitError = checkAuthActionRateLimit("auth:reset-pw", remoteIp, 6, 15 * 60_000);
  if (rateLimitError) return rateLimitError;

  if (!turnstileToken || !(await verifyTurnstileToken(turnstileToken, remoteIp))) {
    return {
      success: false,
      error: "Sicherheitsüberprüfung fehlgeschlagen. Bitte versuchen Sie es erneut.",
    };
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL}/passwort-zuruecksetzen`,
  });

  if (error) {
    console.error("resetPassword error:", error.message);
    if (error.message.includes("security purposes") || error.status === 429) {
      return {
        success: false,
        error: "Aus Sicherheitsgründen können Sie nur alle 60 Sekunden einen neuen Link anfordern. Bitte warten Sie einen Moment.",
      };
    }
    return { success: false, error: "E-Mail konnte nicht gesendet werden." };
  }

  return { success: true };
}

export async function updateEmail(newEmail: string): Promise<AuthResult> {
  const emailParsed = authEmailSchema.safeParse(newEmail);
  if (!emailParsed.success) {
    return { success: false, error: firstZodError(emailParsed.error) };
  }

  const remoteIp = await getRemoteIp();
  const rateLimitError = checkAuthActionRateLimit("auth:update-email", remoteIp, 6, 15 * 60_000);
  if (rateLimitError) return rateLimitError;

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.updateUser(
    { email: emailParsed.data },
    { emailRedirectTo: `${process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL}/konto` }
  );
  if (error) {
    console.error("updateEmail error:", error.message);
    return { success: false, error: "E-Mail-Adresse konnte nicht geändert werden." };
  }
  return { success: true };
}

export async function updatePassword(password: string): Promise<AuthResult> {
  const pwParsed = strongPasswordSchema.safeParse(password);
  if (!pwParsed.success) {
    return { success: false, error: firstZodError(pwParsed.error) };
  }

  const remoteIp = await getRemoteIp();
  const rateLimitError = checkAuthActionRateLimit("auth:update-pw", remoteIp, 10, 15 * 60_000);
  if (rateLimitError) return rateLimitError;

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: pwParsed.data });

  if (error) {
    console.error("updatePassword error:", error.message);
    return { success: false, error: "Passwort konnte nicht aktualisiert werden." };
  }

  return { success: true, redirectTo: "/konto" };
}

export async function updateConsumerProfile(
  data: Partial<Pick<Profile, "username" | "first_name" | "last_name">>
): Promise<AuthResult> {
  const parsed = updateConsumerProfileSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: firstZodError(parsed.error) };
  }

  const remoteIp = await getRemoteIp();
  const rateLimitError = checkAuthActionRateLimit("auth:update-consumer", remoteIp, 20, 15 * 60_000);
  if (rateLimitError) return rateLimitError;

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { success: false, error: "Nicht autorisiert." };
  }

  const safeUpdate: Record<string, string | null> = {};
  if (parsed.data.username !== undefined) {
    safeUpdate.username = parsed.data.username || null;
  }
  if (parsed.data.first_name !== undefined) {
    safeUpdate.first_name = parsed.data.first_name || null;
  }
  if (parsed.data.last_name !== undefined) {
    safeUpdate.last_name = parsed.data.last_name || null;
  }

  const { error } = await supabase
    .from("profiles")
    .update(safeUpdate)
    .eq("id", user.id);

  if (error) {
    console.error("updateConsumerProfile error:", error.message);
    return { success: false, error: "Profil konnte nicht gespeichert werden." };
  }

  return { success: true };
}

export async function updatePartnerProfile(
  data: Partial<Omit<PartnerProfile, "id" | "created_at" | "updated_at">>
): Promise<AuthResult> {
  const parsed = updatePartnerProfileSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: firstZodError(parsed.error) };
  }

  const remoteIp = await getRemoteIp();
  const rateLimitError = checkAuthActionRateLimit("auth:update-partner", remoteIp, 20, 15 * 60_000);
  if (rateLimitError) return rateLimitError;

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { success: false, error: "Nicht autorisiert." };
  }

  const cleanData = parsed.data;
  const safeUpdate: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(cleanData)) {
    if (value !== undefined) {
      safeUpdate[key] = value === "" ? null : value;
    }
  }

  // Jeśli partner zmienia kraj, Steuernummer/UID (`tax_id`) lub numer VAT-EU (`vat_eu`),
  // automatycznie przeliczamy po stronie serwera koszyk podatkowy (`tax_bucket`,
  // `tax_group`, `no_eu_vat`, `cross_border_b2c`), aby stawka VAT przy płatności
  // PayPal zawsze odpowiadała aktualnym danym w profilu.
  const touchesTaxOrCountry =
    "country" in safeUpdate || "tax_id" in safeUpdate || "vat_eu" in safeUpdate;

  if (touchesTaxOrCountry) {
    const { data: currentPartner } = await supabase
      .from("partner_profiles")
      .select("country, tax_id, vat_eu")
      .eq("id", user.id)
      .maybeSingle();

    const effectiveCountry = ((
      "country" in safeUpdate ? safeUpdate.country : currentPartner?.country
    ) as string | null) || null;
    const effectiveTaxId =
      (("tax_id" in safeUpdate ? safeUpdate.tax_id : currentPartner?.tax_id) as string | null) ||
      null;
    const effectiveVatEu =
      (("vat_eu" in safeUpdate ? safeUpdate.vat_eu : currentPartner?.vat_eu) as string | null) ||
      null;

    const countryMeta = getCountry(effectiveCountry);

    // ⚠ Pusty lub nieznany kraj NIE może domyślać się na "DE": stawka VAT
    // liczyłaby się wtedy jak dla Niemiec (brutto 19 %), choć w profilu nie ma
    // żadnego kraju — np. firma ze Szwajcarii, która wyczyści to pole, zapłaciłaby
    // niemiecki podatek. Lista krajów jest zamknięta (`<select>` z COUNTRIES),
    // więc brak trafienia oznacza puste pole albo wartość spoza listy.
    if (!countryMeta) {
      return {
        success: false,
        error: "Bitte wählen Sie das Land Ihres Unternehmens aus.",
      };
    }

    const taxGroup = countryMeta.taxGroup;

    if (taxGroup === "DE" && !effectiveTaxId && !effectiveVatEu) {
      return {
        success: false,
        error: "Für Unternehmen in Deutschland ist die Angabe einer Steuernummer oder USt-IdNr. erforderlich.",
      };
    }

    const hasEuVatId = taxGroup === "EU" && Boolean(effectiveVatEu && effectiveVatEu.trim().length > 0);
    const taxBucket = getTaxBucket(effectiveCountry, hasEuVatId);
    const noEuVat = taxGroup === "EU" ? !hasEuVatId : false;
    const crossBorderB2c = taxBucket === "eu_no_vat";
    const taxIdValue =
      taxGroup === "EU" ? effectiveVatEu : effectiveTaxId ?? effectiveVatEu;

    safeUpdate.tax_group = taxGroup;
    safeUpdate.tax_bucket = taxBucket;
    safeUpdate.tax_id_field_key = countryMeta.taxIdFieldKey;
    safeUpdate.tax_id_value = taxIdValue;
    safeUpdate.no_eu_vat = noEuVat;
    safeUpdate.cross_border_b2c = crossBorderB2c;
  }

  const { error } = await supabase
    .from("partner_profiles")
    .update(safeUpdate)
    .eq("id", user.id);

  if (error) {
    console.error("updatePartnerProfile error:", error.message);
    return { success: false, error: "Partnerprofil konnte nicht gespeichert werden." };
  }

  return { success: true };
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  let partnerProfile = null;
  if (profile?.role === "partner") {
    const { data } = await supabase
      .from("partner_profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    partnerProfile = data;
  }

  return {
    id: user.id,
    email: user.email ?? null,
    profile: profile ?? null,
    partnerProfile,
  };
}
