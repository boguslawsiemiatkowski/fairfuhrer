// supabase-image-loader.ts
interface LoaderProps {
  src: string;
  width: number;
  quality?: number;
}

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(
  /\/+$/,
  "",
);
const OBJECT_PUBLIC_SEGMENT = "/storage/v1/object/public/";
const RENDER_PUBLIC_SEGMENT = "/storage/v1/render/image/public/";

export default function supabaseLoader({
  src,
  width,
  quality = 75,
}: LoaderProps): string {
  // 1. Lokalne zasoby z folderu public/ lub _next/static/
  if (src.startsWith("/")) {
    return src;
  }

  // 2. Pełne adresy URL (Directus /assets/... lub Supabase Storage)
  if (src.startsWith("http://") || src.startsWith("https://")) {
    try {
      const url = new URL(src);

      // Supabase Storage: zamień /object/public/ na endpoint transformacji /render/image/public/
      if (url.pathname.includes(OBJECT_PUBLIC_SEGMENT)) {
        url.pathname = url.pathname.replace(
          OBJECT_PUBLIC_SEGMENT,
          RENDER_PUBLIC_SEGMENT,
        );
        url.searchParams.set("width", width.toString());
        url.searchParams.set("quality", quality.toString());
        url.searchParams.set("resize", "contain");
        return url.toString();
      }

      // Directus CMS (/assets/<uuid>): dodaj parametry transformacji bez powiększania małych plików
      if (url.pathname.includes("/assets/")) {
        url.searchParams.set("width", width.toString());
        url.searchParams.set("quality", quality.toString());
        url.searchParams.set("withoutEnlargement", "true");
        return url.toString();
      }

      // Inne zewnętrzne URL-e (np. już zawierające /render/image/public/)
      url.searchParams.set("width", width.toString());
      url.searchParams.set("quality", quality.toString());
      return url.toString();
    } catch {
      return src;
    }
  }

  // 3. Ścieżki względne Supabase Storage (np. z getOptimizedImagePath: "media-files/...")
  if (SUPABASE_URL) {
    return `${SUPABASE_URL}${RENDER_PUBLIC_SEGMENT}${src}?width=${width}&quality=${quality}&resize=contain`;
  }

  return src;
}
