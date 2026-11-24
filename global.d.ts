// global.d.ts

// Typy dla importów obrazów (`import logo from "@/public/logo.png"`).
//
// ⚠ Normalnie dostarcza je `next-env.d.ts`, ale ten plik jest w .gitignore
// (tak chce Next.js) i powstaje dopiero przy `next build`. Nasz skrypt build
// to `tsgo --noEmit && next build`, więc sprawdzanie typów rusza ZANIM plik
// istnieje — na czystym klonie (Render) build padał na „Cannot find module
// '@/public/*.svg'", mimo że lokalnie przechodził.
/// <reference types="next/image-types/global" />

declare module "*.json" {
  import type { StyleSpecification } from "mapbox-gl";
  const value: StyleSpecification;
  export default value;
}

interface Window {
  gtag: (command: string, ...args: unknown[]) => void;
  dataLayer: Record<string, unknown>[];
}
