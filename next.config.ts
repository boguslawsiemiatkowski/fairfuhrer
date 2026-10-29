// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Warnt bei `next dev` / `next build`, wenn die installierte Next.js-Version
  // eine bekannte Sicherheitslücke hat. Bewusst "security" statt "latest" —
  // keine Hinweise auf jedes neue Minor-Release.
  experimental: {
    agentUpgrade: "security",
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