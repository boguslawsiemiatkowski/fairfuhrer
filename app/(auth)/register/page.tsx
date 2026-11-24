import Link from "next/link";
import { getRegisterPageContent } from "@/lib/directus";
import styles from "./register.module.css";

function getSafeRedirectPath(value: string | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return null;
  }
  return value;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const [content, resolvedSearchParams] = await Promise.all([
    getRegisterPageContent(),
    searchParams,
  ]);

  const safeRedirect = getSafeRedirectPath(resolvedSearchParams?.redirect);
  const redirectQuery = safeRedirect ? `?redirect=${encodeURIComponent(safeRedirect)}` : "";

  const t = {
    title: content?.title || "Konto erstellen",
    subtitle:
      content?.subtitle || "Wählen Sie aus, wie Sie Fairführer nutzen möchten.",
    reisender_title: content?.reisender_title || "Als Reisende*r",
    reisender_desc:
      content?.reisender_desc ||
      "Entdecken Sie nachhaltige Orte, folgen Sie Partnern und kommunizieren Sie mit der Community.",
    reisender_cta: content?.reisender_cta || "Weiter →",
    partner_title: content?.partner_title || "Als Partner*in",
    partner_desc:
      content?.partner_desc ||
      "Präsentieren Sie Ihr nachhaltiges Unternehmen, teilen Sie Neuigkeiten und erreichen Sie unsere Community.",
    partner_cta: content?.partner_cta || "Weiter →",
    login_prompt: content?.login_prompt || "Bereits registriert?",
    login_link_text: content?.login_link_text || "Anmelden",
  };

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>{t.title}</h1>
      <p className={styles.subtitle}>{t.subtitle}</p>
      <div className={styles.cards}>
        <Link href={`/register/consumer${redirectQuery}`} className={styles.card}>
          <div className={styles.cardIcon}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h2 className={styles.cardTitle}>{t.reisender_title}</h2>
          <p className={styles.cardDesc}>{t.reisender_desc}</p>
          <span className={styles.cardCta}>{t.reisender_cta}</span>
        </Link>

        <Link href={`/register/partner${redirectQuery}`} className={styles.card}>
          <div className={styles.cardIcon}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m11 17 2 2a1 1 0 1 0 3-3" />
              <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
              <path d="m21 3 1 11h-2" />
              <path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" />
              <path d="M3 4h8" />
            </svg>
          </div>
          <h2 className={styles.cardTitle}>{t.partner_title}</h2>
          <p className={styles.cardDesc}>{t.partner_desc}</p>
          <span className={styles.cardCta}>{t.partner_cta}</span>
        </Link>
      </div>

      <p className={styles.loginLink}>
        {t.login_prompt}{" "}
        <Link href={`/login${redirectQuery}`} className={styles.link}>
          {t.login_link_text}
        </Link>
      </p>
    </div>
  );
}
