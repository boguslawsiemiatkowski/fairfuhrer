import "server-only";

import { NextRequest, NextResponse } from "next/server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_MIME_PREFIXES = ["image/", "audio/"];

function isAllowedAssetContentType(contentType: string): boolean {
  const normalized = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  // Blokujemy image/svg+xml pod kątem potencjalnego wykonywania skryptów w bezpośredniej nawigacji
  if (normalized === "image/svg+xml") {
    return false;
  }
  return ALLOWED_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_REGEX.test(id)) {
    return new NextResponse("Ungültige Datei-ID.", { status: 400 });
  }

  const directusUrl = process.env.DIRECTUS_URL?.replace(/\/+$/, "");
  const directusToken = process.env.DIRECTUS_TOKEN;
  if (!directusUrl || !directusToken) {
    return new NextResponse("Serverkonfigurationsfehler.", { status: 500 });
  }

  const upstreamHeaders: Record<string, string> = {
    Authorization: `Bearer ${directusToken}`,
  };
  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    upstreamHeaders.Range = rangeHeader;
  }

  const upstream = await fetch(`${directusUrl}/assets/${encodeURIComponent(id)}`, {
    headers: upstreamHeaders,
  });

  if (!upstream.ok && upstream.status !== 206) {
    return new NextResponse("Not found.", { status: upstream.status });
  }

  const rawContentType =
    upstream.headers.get("content-type") ?? "application/octet-stream";

  if (!isAllowedAssetContentType(rawContentType)) {
    return new NextResponse("Nicht unterstützter Dateityp.", { status: 415 });
  }

  const headers = new Headers({
    "Content-Type": rawContentType,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    "Cross-Origin-Resource-Policy": "same-origin",
  });

  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);

  const contentRange = upstream.headers.get("content-range");
  if (contentRange) headers.set("Content-Range", contentRange);

  const acceptRanges = upstream.headers.get("accept-ranges");
  if (acceptRanges) headers.set("Accept-Ranges", acceptRanges);

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
}
