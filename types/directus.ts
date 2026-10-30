import type { GeoJSONPoint } from "./map";

export interface DirectusMeta {
  total_count?: number;
  filter_count?: number;
}

export interface DirectusError {
  message: string;
  extensions: {
    code: string;
    [key: string]: unknown;
  };
}

export interface DirectusCollectionResponse<T> {
  data: T[];
  meta?: DirectusMeta;
  errors?: DirectusError[];
}

export interface DirectusKategorie {
  id: number;
  Name: string;
  Farbe: string;
  Beschreibung?: string;
}

export interface DirectusOrteKategorie {
  id: number;
  Orte_id: number;
  Kategorie_id: DirectusKategorie;
}

export interface DirectusZertifizierungItem {
  Zertifizierungen_id: {
    id: string;
    Name: string;
    Image?: string;
    slug?: string;
  } | null;
}

export interface DirectusOrte {
  id: number;
  Name: string;
  /** URL-Segment für /orte/[stadt]/[slug]; in Directus gepflegt. */
  slug?: string;
  Adresse: string;
  Stadt?: string;
  Land?: string;
  Telefon?: string;
  Vollbeschreibung?: string;
  location?: GeoJSONPoint;
  Kategorie?: DirectusOrteKategorie[];
  Hauptbild?: string;
  Titelbild?: string;
  Audio_Datei?: string;
  Audio?: string;
  Link_URL?: string;
  Link_Text?: string;
  Galerie_Bilder?: string[];
  Galerie?: ({ id: number; directus_files_id: string } | string)[];
  Zertifizierungen?: DirectusZertifizierungItem[];
}