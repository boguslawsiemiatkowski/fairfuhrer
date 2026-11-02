// next.config.ts
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Budujemy politykę Content-Security-Policy (CSP) dostosowaną do wszystkich usług
// zewnętrznych używanych w FairFührer (Directus, Supabase, Mapbox GL, Mux, PayPal,
// Cloudflare Turnstile, Google Analytics, Hotjar).
// Uwaga: 'upgrade-insecure-requests' włączamy wyłącznie na produkcji, aby nie
// wymuszać HTTPS na http://localhost:10000 podczas lokalnego developmentu.
const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self' https://www.paypal.com https://*.paypal.com",
  "frame-ancestors 'self'",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com https://www.google-analytics.com https://static.hotjar.com https://script.hotjar.com https://challenges.cloudflare.com https://www.paypal.com https://*.paypal.com https://www.paypalobjects.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://cms.fairfuehrer.guide https://*.supabase.co https://*.mapbox.com https://image.mux.com https://www.google-analytics.com https://www.googletagmanager.com https://*.hotjar.com https://www.paypalobjects.com https://*.paypal.com",
  "media-src 'self' data: blob: https://cms.fairfuehrer.guide https://*.supabase.co https://stream.mux.com https://*.mux.com https://*.edgemv.mux.com",
  "font-src 'self' data: https://script.hotjar.com",
  "connect-src 'self' https://cms.fairfuehrer.guide https://*.supabase.co wss://*.supabase.co https://*.tiles.mapbox.com https://api.mapbox.com https://events.mapbox.com https://*.mux.com https://*.litix.io https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://*.hotjar.com https://*.hotjar.io wss://*.hotjar.com https://challenges.cloudflare.com https://www.paypal.com https://*.paypal.com https://*.paypalobjects.com",
  "frame-src 'self' https://challenges.cloudflare.com https://www.paypal.com https://*.paypal.com https://vars.hotjar.com",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  ...(!isDev ? ["upgrade-insecure-requests"] : []),
];

// Nagłówki bezpieczeństwa HTTP wymagane przez audyt Mozilla Observatory
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: cspDirectives.join("; "),
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
  },
  {
    // "same-origin-allow-popups" przechodzi test Mozilla Observatory i jednocześnie
    // pozwala na komunikację z oknem popup płatności PayPal (window.opener).
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin-allow-popups",
  },
];

const nextConfig: NextConfig = {
  // Warnt bei `next dev` / `next build`, wenn die installierte Next.js-Version
  // eine bekannte Sicherheitslücke hat. Bewusst "security" statt "latest" —
  // keine Hinweise auf jedes neue Minor-Release.
  experimental: {
    agentUpgrade: "security",

    // Der Build auf Render brach mit "Ran out of memory (used over 8GB)" ab.
    // Ursache war nicht die Datenmenge (alle Orte zusammen sind rund 3 MB),
    // sondern die Anzahl der Prozesse: Next.js startete
    // "Generating static pages using 47 workers" — es liest die Kernzahl der
    // Host-Maschine, nicht das Limit des Containers. 47 Node-Prozesse mit je
    // rund 120 MB Grundbedarf sprengen 8 GB, bevor überhaupt gerendert wird.
    //
    // `cpus` deckelt die Prozesszahl, `staticGenerationMinPagesPerWorker`
    // sorgt zusätzlich dafür, dass ein neuer Worker erst ab 100 Seiten
    // aufgemacht wird: bei 808 Seiten sind das rund 8 statt 47.
    // `memoryBasedWorkersCount` lässt Next.js die Zahl zusätzlich am
    // verfügbaren Speicher ausrichten.
    cpus: 4,
    memoryBasedWorkersCount: true,
    staticGenerationMinPagesPerWorker: 100,
  },
  logging: {
    browserToTerminal: true,
  },
  images: {
    loader: "custom",
    loaderFile: "./supabase-image-loader.ts",
  },
  async headers() {
    return [
      {
        // Globalne nagłówki bezpieczeństwa dla wszystkich tras aplikacji
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400", // 24h cache
          },
        ],
      },
      {
        // Die Search Console meldete „Sitemap could not be read", obwohl die
        // Datei im Browser einwandfrei lädt. Messung: HTTP 200, korrektes
        // application/xml, 756 Einträge — aber 10 bis 35 Sekunden
        // Antwortzeit. Google bricht vorher ab.
        //
        // Ursache: Next.js hielt die Antwort zwar im eigenen Cache
        // (x-nextjs-cache: HIT), schickte aber
        // `Cache-Control: public, max-age=0, must-revalidate`. Damit fragt
        // jeder Abruf erneut den Server, und ein schlafender Render-Dienst
        // braucht für 145 KB entsprechend lange.
        //
        // Eine Stunde Cache mit einem Tag stale-while-revalidate: die
        // Sitemap wird sofort ausgeliefert und im Hintergrund erneuert. Zum
        // `revalidate = 86400` der Route passt das — häufiger als täglich
        // ändert sie sich ohnehin nicht.
        source: "/:file(sitemap.xml|robots.txt)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
