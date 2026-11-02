// app/manifest.ts
// Natywny Web App Manifest Next.js (generuje /manifest.webmanifest).
// Umożliwia instalację FairFührer jako aplikacji PWA na ekranie głównym smartfona
// podczas podróży nad Jeziorem Bodeńskim i w regionie Allgäu.
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FAIRFÜHRER — Nachhaltig Leben & Reisen",
    short_name: "Fairführer",
    description:
      "Der Reiseführer für nachhaltiges Leben & Reisen am Bodensee und im Allgäu.",
    start_url: "/karte",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2d6a4f",
    lang: "de",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}

