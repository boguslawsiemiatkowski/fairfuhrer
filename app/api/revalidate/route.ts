import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

// Directus-Flows feuern pro geändertem Datensatz. Bei einer Massenänderung —
// etwa als die 592 slugs gesetzt wurden — kam der Flow "Orte Updates" also
// 592 Mal an, im Abstand von rund 130 ms. Das ist nicht gefährlich (ein Tag
// mehrfach zu invalidieren ist harmlos), erzeugt aber sinnlose Last und
// hunderte Logzeilen.
//
// Deshalb eine Sperrzeit pro Tag: der erste Aufruf wirkt sofort, weitere
// innerhalb des Fensters werden übersprungen. Inhaltsänderungen bleiben
// damit unmittelbar sichtbar, eine Lawine wird auf einen Aufruf reduziert.
//
// Der Speicher liegt im Prozess: nach einem Neustart ist er leer, und bei
// mehreren Instanzen zählt jede für sich. Für diesen Zweck genügt das —
// schlimmstenfalls wird einmal zu viel invalidiert.
const THROTTLE_MS = 5000;
const lastRevalidated = new Map<string, number>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { secret, tags } = body;

    const revalidateSecret = process.env.REVALIDATE_SECRET_TOKEN;

    if (!revalidateSecret) {
      console.error("REVALIDATE_SECRET_TOKEN not configured");
      return NextResponse.json(
        { error: "Revalidation not configured" },
        { status: 500 },
      );
    }

    if (secret !== revalidateSecret) {
      return NextResponse.json(
        { error: "Invalid secret token" },
        { status: 401 },
      );
    }

    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return NextResponse.json(
        { error: "Missing or empty tags array" },
        { status: 400 },
      );
    }

    const now = Date.now();
    const revalidated: string[] = [];
    const throttled: string[] = [];

    for (const tag of tags) {
      const last = lastRevalidated.get(tag) ?? 0;
      if (now - last < THROTTLE_MS) {
        throttled.push(tag);
        continue;
      }
      lastRevalidated.set(tag, now);
      revalidateTag(tag, { expire: 0 });
      revalidated.push(tag);
      console.log(`Revalidated tag: ${tag}`);
    }

    if (throttled.length > 0) {
      console.log(
        `Revalidation übersprungen (Sperrzeit ${THROTTLE_MS} ms): ${throttled.join(", ")}`,
      );
    }

    return NextResponse.json({
      revalidated: revalidated.length > 0,
      tags: revalidated,
      throttled,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in revalidation endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
