export interface Category {
  id: number;
  name: string;
  color: string;
  description?: string;
}

export interface Zertifizierung {
  id: string;
  name: string;
  imageUuid?: string;
  slug?: string;
}

export type Kategorie = Category;

export interface GeoJSONPoint {
  type: "Point";
  coordinates: [number, number];
}

export interface Place {
  id: number;
  Name: string;
  /**
   * Teil der URL unter /orte/[stadt]/[slug]. In Directus gepflegt und
   * absichtlich unabhängig von `Name`: eine Namenskorrektur darf die von
   * Google indexierte Adresse nicht ändern. Leer = Pin erscheint auf der
   * Karte, bekommt aber keine eigene Seite.
   */
  slug?: string;
  Adresse: string;
  Stadt?: string;
  Land?: string;
  Telefon?: string;
  Vollbeschreibung?: string;
  location: GeoJSONPoint;
  Kategorie: Category[];
  Hauptbild?: string;
  Titelbild?: string;
  Audio_Datei?: string;
  Audio?: string;
  Link_URL?: string;
  Link_Text?: string;
  Galerie_Bilder?: string[];
  Galerie?: string[];
  Zertifizierungen?: Zertifizierung[];
}

export type Orte = Place;

export type GeolocationErrorCode = 1 | 2 | 3;
export type PanelState = "closed" | "opening" | "open" | "closing";
export type LoadingState = "idle" | "loading" | "success" | "error";

export interface MapConfig {
  readonly INITIAL_CENTER: readonly [number, number];
  readonly INITIAL_ZOOM: number;
  readonly USER_LOCATION_ZOOM: number;
  readonly MOBILE_BREAKPOINT: number;
  readonly ANIMATION_DURATION: number;
  readonly MOBILE_ANIMATION_DURATION: number;
}

export interface MapBoxMapProps {
  places: Place[];
}

export interface GeolocationState {
  location: [number, number] | null;
  error: string | null;
  isLoading: boolean;
}

export interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

export type MapErrorCode =
  | "MAPBOX_TOKEN"
  | "GEOLOCATION"
  | "API_ERROR"
  | "INVALID_DATA";

export interface MapErrorInfo {
  code: MapErrorCode;
  message: string;
  originalError?: unknown;
}
