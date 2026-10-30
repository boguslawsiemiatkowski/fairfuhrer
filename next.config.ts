// next.config.ts
import type { NextConfig } from "next";

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
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400", // 24h cache
          },
        ],
      },
    ];
  },
};

export default nextConfig;