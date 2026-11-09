// app/karte/loading.tsx
// Jednolity szkielet ładowania trasy /karte — identyczny z MapSkeleton w MapWithFilters
// oraz MapBoxMap, dzięki czemu nie występuje żaden przeskok wizualny ani stara legenda.

import { MapSkeleton } from "../../components/MapWithFilters";

export default function Loading() {
  return <MapSkeleton />;
}
