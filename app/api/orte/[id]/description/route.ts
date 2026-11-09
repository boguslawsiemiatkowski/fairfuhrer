import { NextResponse } from "next/server";
import { fetchPlaceDescription } from "@/lib/orte";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/orte/[id]/description
 *
 * Zwraca oczyszczony HTML `Vollbeschreibung` dla pojedynczego miejsca.
 * Wykorzystywany przez `PlaceInfoPanel` na stronie `/karte`, aby początkowy
 * payload RSC mapy nie musiał serializować pełnych opisów dla ~592 pinów.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const placeId = Number(id);

  if (!Number.isInteger(placeId) || placeId <= 0) {
    return NextResponse.json({ error: "Ungültige Orts-ID" }, { status: 400 });
  }

  try {
    const description = await fetchPlaceDescription(placeId);
    return NextResponse.json(
      { description },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    console.error(`Błąd pobierania opisu dla miejsca ${placeId}:`, error);
    return NextResponse.json(
      { error: "Beschreibung konnte nicht geladen werden" },
      { status: 500 },
    );
  }
}
