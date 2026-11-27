// lib/reportError.ts
/**
 * Zgłasza błąd z route-level / global Error Boundaries:
 * 1. Do konsoli przeglądarki
 * 2. Do własnego endpointu 1st-party `/api/error-report` -> kolekcja `web_error_logs`
 *    w Directusie (działa zawsze, bez zewnętrznych ciasteczek i bez naruszania RODO)
 * 3. Opcjonalnie do Google Analytics (tylko jeśli użytkownik wyraził zgodę na cookies).
 */
export function reportError(
  error: Error & { digest?: string },
  context: string
): void {
  console.error(`🚨 ${context}:`, error);

  if (typeof window === "undefined") {
    return;
  }

  // 1. Raport 1st-party do Directusa (kolekcja `web_error_logs`)
  try {
    fetch("/api/error-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context,
        message: error.message || "Unknown client error",
        digest: error.digest ?? null,
        url: `${window.location.pathname}${window.location.search}`,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Ignorujemy błędy sieciowe podczas raportowania błędu
  }

  // 2. Google Analytics (tylko za zgodą użytkownika, gdy gtag jest aktywny)
  if (typeof window.gtag === "function") {
    window.gtag("event", "exception", {
      description: `${context}: ${error.message}`,
      fatal: false,
      digest: error.digest,
    });
  }
}
