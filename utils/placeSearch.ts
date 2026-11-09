// utils/placeSearch.ts
// Współdzielony silnik wyszukiwania lokalnych pinów (wielowyrazowy, odporny na umlauty
// ä↔a/ae, ö↔o/oe, ü↔u/ue, ß↔ss i akcenty) oraz zapytań geograficznych Mapbox Geocoding v6.

import type { Place } from "../types/map";

export interface SearchSuggestion {
  id: string;
  name: string;
  place_formatted: string;
  lat: number;
  lon: number;
  bbox: [number, number, number, number] | null;
  feature_type: string; // place / region / pin
  placeId?: number; // ustawione → lokalny pin FairFührer
}

// Dodatkowe słowa kluczowe dla kategorii Directus, ułatwiające wyszukiwanie po typie miejsca
const CATEGORY_SYNONYMS: Record<number, string> = {
  1: "sehenswertes erlebnisse kultur ausflug sehenswuerdigkeit museum natur",
  2: "essen uebernachten gastronomie restaurant cafe bistro hotel pension unterkunft",
  3: "einkaufen laden geschaeft shop mode hofladen baeckerei kaeserei weltladen",
  5: "engagement verein initiative bildung soziales nachhaltigkeit",
  8: "unternehmen handwerk betrieb firma dienstleistung",
};

function cleanBase(input: string): string {
  return input
    .replace(/[\u00AD\u200B-\u200D\uFEFF]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss");
}

/** Wariant uproszczony: ä→a, ö→o, ü→u oraz usunięcie znaków diakrytycznych (np. Café→cafe). */
export function foldAscii(input: string): string {
  return cleanBase(input)
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Wariant z niemieckimi dwuznakami: ä→ae, ö→oe, ü→ue (np. Allgäu→allgaeu, Füssen→fuessen). */
export function foldGerman(input: string): string {
  return cleanBase(input)
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface IndexedPlace {
  place: Place;
  nameAscii: string;
  nameGerman: string;
  nameWordsAscii: string[];
  nameWordsGerman: string[];
  nameCompactAscii: string;
  nameCompactGerman: string;
  cityAscii: string;
  cityGerman: string;
  landAscii: string;
  landGerman: string;
  addressAscii: string;
  addressGerman: string;
  categoriesAscii: string;
  categoriesGerman: string;
  certsAscii: string;
  certsGerman: string;
  nonGeoAscii: string;
  nonGeoGerman: string;
  fullAscii: string;
  fullGerman: string;
  hasAudio: boolean;
  formattedSubtitle: string;
}

export function buildSearchIndex(places: Place[]): IndexedPlace[] {
  return places
    .filter((p) => Boolean(p.location?.coordinates))
    .map((place) => {
      const rawName = place.Name ?? "";
      const rawCity = place.Stadt ?? "";
      const rawLand = place.Land ?? "";
      const rawAddress = place.Adresse ?? "";
      const rawCategories = place.Kategorie.map(
        (c) => `${c.name} ${CATEGORY_SYNONYMS[c.id] ?? ""}`,
      ).join(" ");
      const rawCerts = (place.Zertifizierungen ?? [])
        .map((z) => z.name)
        .join(" ");
      const hasAudio = Boolean(place.Audio || place.Audio_Datei);
      const audioTerms = hasAudio ? "audio audioguide hoeren" : "";

      const nameAscii = foldAscii(rawName);
      const nameGerman = foldGerman(rawName);
      const cityAscii = foldAscii(rawCity);
      const cityGerman = foldGerman(rawCity);
      const landAscii = foldAscii(rawLand);
      const landGerman = foldGerman(rawLand);
      const addressAscii = foldAscii(rawAddress);
      const addressGerman = foldGerman(rawAddress);
      const categoriesAscii = foldAscii(rawCategories);
      const categoriesGerman = foldGerman(rawCategories);
      const certsAscii = foldAscii(rawCerts);
      const certsGerman = foldGerman(rawCerts);

      const nonGeoAscii = [
        nameAscii,
        addressAscii,
        categoriesAscii,
        certsAscii,
        audioTerms,
      ]
        .filter(Boolean)
        .join(" ");
      const nonGeoGerman = [
        nameGerman,
        addressGerman,
        categoriesGerman,
        certsGerman,
        audioTerms,
      ]
        .filter(Boolean)
        .join(" ");

      const fullAscii = [nonGeoAscii, cityAscii, landAscii]
        .filter(Boolean)
        .join(" ");
      const fullGerman = [nonGeoGerman, cityGerman, landGerman]
        .filter(Boolean)
        .join(" ");

      const primaryCat = place.Kategorie[0]?.name;
      const locationPart = [place.Stadt, place.Adresse]
        .filter(Boolean)
        .join(", ");
      const formattedSubtitle = [primaryCat, locationPart]
        .filter(Boolean)
        .join(" · ");

      return {
        place,
        nameAscii,
        nameGerman,
        nameWordsAscii: nameAscii.split(/\s+/).filter(Boolean),
        nameWordsGerman: nameGerman.split(/\s+/).filter(Boolean),
        nameCompactAscii: nameAscii.replace(/\s+/g, ""),
        nameCompactGerman: nameGerman.replace(/\s+/g, ""),
        cityAscii,
        cityGerman,
        landAscii,
        landGerman,
        addressAscii,
        addressGerman,
        categoriesAscii,
        categoriesGerman,
        certsAscii,
        certsGerman,
        nonGeoAscii,
        nonGeoGerman,
        fullAscii,
        fullGerman,
        hasAudio,
        formattedSubtitle:
          formattedSubtitle ||
          [place.Stadt, place.Land].filter(Boolean).join(", "),
      };
    });
}

export function searchIndexedPins(
  query: string,
  indexedPlaces: IndexedPlace[],
  excludePlaceId?: number,
): { directPins: SearchSuggestion[]; cityOnlyPins: SearchSuggestion[] } {
  const qAscii = foldAscii(query);
  const qGerman = foldGerman(query);
  if (qAscii.length < 2) {
    return { directPins: [], cityOnlyPins: [] };
  }

  const tokensAscii = qAscii.split(/\s+/).filter(Boolean);
  const tokensGerman = qGerman.split(/\s+/).filter(Boolean);
  if (tokensAscii.length === 0) {
    return { directPins: [], cityOnlyPins: [] };
  }

  const scoredDirect: { score: number; item: IndexedPlace }[] = [];
  const scoredCityOnly: { score: number; item: IndexedPlace }[] = [];

  for (const item of indexedPlaces) {
    if (excludePlaceId !== undefined && item.place.id === excludePlaceId) {
      continue;
    }

    let allMatched = true;
    let matchedNonGeo = false;
    let score = 0;

    for (let i = 0; i < tokensAscii.length; i++) {
      const tA = tokensAscii[i];
      const tG = tokensGerman[i] ?? tA;

      const inFull =
        item.fullAscii.includes(tA) ||
        item.fullGerman.includes(tG) ||
        item.fullGerman.includes(tA) ||
        item.fullAscii.includes(tG) ||
        (tA.length >= 4 &&
          (item.nameCompactAscii.includes(tA) ||
            item.nameCompactGerman.includes(tG) ||
            item.nameCompactGerman.includes(tA)));

      if (!inFull) {
        allMatched = false;
        break;
      }

      const tokenInNonGeo =
        item.nonGeoAscii.includes(tA) ||
        item.nonGeoGerman.includes(tG) ||
        item.nonGeoGerman.includes(tA) ||
        (tA.length >= 4 &&
          (item.nameCompactAscii.includes(tA) ||
            item.nameCompactGerman.includes(tG) ||
            item.nameCompactGerman.includes(tA)));

      if (tokenInNonGeo) {
        matchedNonGeo = true;
      }

      // Punktacja za dopasowanie tokenu w poszczególnych polach
      if (
        item.nameWordsAscii.some((w) => w.startsWith(tA) || w.startsWith(tG)) ||
        item.nameWordsGerman.some((w) => w.startsWith(tG) || w.startsWith(tA))
      ) {
        score += 45;
      } else if (
        item.nameAscii.includes(tA) ||
        item.nameGerman.includes(tG) ||
        item.nameGerman.includes(tA) ||
        (tA.length >= 4 &&
          (item.nameCompactAscii.includes(tA) ||
            item.nameCompactGerman.includes(tG)))
      ) {
        score += 28;
      }

      if (
        item.categoriesAscii.includes(tA) ||
        item.categoriesGerman.includes(tG) ||
        item.certsAscii.includes(tA) ||
        item.certsGerman.includes(tG)
      ) {
        score += 22;
      }

      if (
        item.addressAscii.includes(tA) ||
        item.addressGerman.includes(tG) ||
        item.addressGerman.includes(tA)
      ) {
        score += 18;
      }

      if (
        item.cityAscii === tA ||
        item.cityGerman === tG ||
        item.cityGerman === tA
      ) {
        score += 25;
      } else if (
        item.cityAscii.startsWith(tA) ||
        item.cityGerman.startsWith(tG) ||
        item.cityGerman.startsWith(tA)
      ) {
        score += 16;
      } else if (
        item.cityAscii.includes(tA) ||
        item.cityGerman.includes(tG) ||
        item.landAscii.includes(tA) ||
        item.landGerman.includes(tG)
      ) {
        score += 10;
      }
    }

    if (!allMatched) continue;

    // Bonusy za dopasowanie całej frazy w nazwie pinu
    if (
      item.nameAscii === qAscii ||
      item.nameGerman === qGerman ||
      item.nameGerman === qAscii
    ) {
      score += 150;
    } else if (
      item.nameAscii.startsWith(qAscii) ||
      item.nameGerman.startsWith(qGerman) ||
      item.nameGerman.startsWith(qAscii)
    ) {
      score += 100;
    } else if (
      item.nameAscii.includes(qAscii) ||
      item.nameGerman.includes(qGerman) ||
      item.nameGerman.includes(qAscii)
    ) {
      score += 65;
    }

    if (item.hasAudio) {
      score += 2;
    }

    if (matchedNonGeo) {
      scoredDirect.push({ score, item });
    } else {
      scoredCityOnly.push({ score, item });
    }
  }

  const sortByScoreAndName = (
    a: { score: number; item: IndexedPlace },
    b: { score: number; item: IndexedPlace },
  ) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.item.place.Name ?? "").localeCompare(
      b.item.place.Name ?? "",
      "de",
    );
  };

  scoredDirect.sort(sortByScoreAndName);
  scoredCityOnly.sort(sortByScoreAndName);

  const toSuggestion = ({
    item,
  }: {
    item: IndexedPlace;
  }): SearchSuggestion => ({
    id: `pin-${item.place.id}`,
    name: item.place.Name ?? "",
    place_formatted: item.formattedSubtitle,
    lat: item.place.location.coordinates[1],
    lon: item.place.location.coordinates[0],
    bbox: null,
    feature_type: "pin",
    placeId: item.place.id,
  });

  return {
    directPins: scoredDirect.slice(0, 8).map(toSuggestion),
    cityOnlyPins: scoredCityOnly.slice(0, 6).map(toSuggestion),
  };
}

export async function fetchMapboxSuggestions(
  query: string,
  signal: AbortSignal,
): Promise<SearchSuggestion[]> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
  if (!token || query.trim().length < 2) return [];

  const url =
    `https://api.mapbox.com/search/geocode/v6/forward` +
    `?q=${encodeURIComponent(query.trim())}` +
    `&language=de` +
    `&country=DE,AT,CH,FR,LI,IT` +
    `&proximity=9.5,47.65` +
    `&limit=5` +
    `&types=country,region,district,place,locality,address` +
    `&autocomplete=true` +
    `&access_token=${token}`;

  const r = await fetch(url, { signal });
  if (!r.ok) return [];
  const json = (await r.json()) as { features?: Record<string, unknown>[] };
  const features = json.features ?? [];

  return features.map((f) => {
    const props = f.properties as Record<string, unknown>;
    const geom = f.geometry as { coordinates: [number, number] };
    const rawBbox = props.bbox as number[] | undefined;
    const bbox: [number, number, number, number] | null =
      rawBbox?.length === 4
        ? [rawBbox[0], rawBbox[1], rawBbox[2], rawBbox[3]]
        : null;
    return {
      id: (props.mapbox_id as string) ?? String(Math.random()),
      name: (props.name as string) ?? "",
      place_formatted: (props.place_formatted as string) ?? "",
      lat: geom.coordinates[1],
      lon: geom.coordinates[0],
      bbox,
      feature_type: (props.feature_type as string) ?? "place",
    };
  });
}
