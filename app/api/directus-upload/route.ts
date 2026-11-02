import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
]);

const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/ogg",
  "audio/aac",
  "audio/webm",
  "audio/flac",
]);

const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_AUDIO_BYTES = 50 * 1024 * 1024; // 50 MB

export async function POST(request: NextRequest) {
  try {
    // Auth: cookies (web) LUB Bearer token (mobile) — patrz lib/api-auth.ts.
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
    }

    const directusUrl = process.env.DIRECTUS_URL?.replace(/\/+$/, "");
    const directusToken = process.env.DIRECTUS_TOKEN;
    if (!directusUrl || !directusToken) {
      return NextResponse.json({ error: "Serverkonfigurationsfehler." }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Keine gültige Datei empfangen." }, { status: 400 });
    }

    const mimeType = file.type.toLowerCase();
    const isImage = ALLOWED_IMAGE_TYPES.has(mimeType);
    const isAudio = ALLOWED_AUDIO_TYPES.has(mimeType);

    if (!isImage && !isAudio) {
      return NextResponse.json(
        {
          error:
            "Ungültiger Dateityp. Erlaubt sind nur Bilder (JPG, PNG, WebP, GIF, AVIF, HEIC) und Audiodateien (MP3, M4A, WAV, OGG, AAC, FLAC).",
        },
        { status: 415 }
      );
    }

    if (isImage && file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Bilddatei ist zu groß (maximal 15 MB erlaubt)." },
        { status: 413 }
      );
    }

    if (isAudio && file.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: "Audiodatei ist zu groß (maximal 50 MB erlaubt)." },
        { status: 413 }
      );
    }

    const directusForm = new FormData();
    directusForm.append("file", file);

    const res = await fetch(`${directusUrl}/files`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${directusToken}`,
      },
      body: directusForm,
    });

    const resText = await res.text();

    if (!res.ok) {
      console.error("Directus upload failed:", res.status, resText);
      return NextResponse.json({ error: "Upload zu Directus fehlgeschlagen." }, { status: 500 });
    }

    if (!resText) {
      return NextResponse.json({ error: "Directus hat keine ID zurückgegeben." }, { status: 500 });
    }

    const data = JSON.parse(resText);
    const fileId = data.data?.id as string;

    if (!fileId) {
      return NextResponse.json({ error: "Keine Datei-ID erhalten." }, { status: 500 });
    }

    return NextResponse.json({ id: fileId }, { status: 201 });
  } catch (error) {
    console.error("directus-upload error:", error);
    return NextResponse.json({ error: "Serverfehler." }, { status: 500 });
  }
}
