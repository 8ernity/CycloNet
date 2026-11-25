import L from "leaflet";

export interface MapStyleDefinition {
  name: string;
  url: string;
  attribution: string;
}

export type MapStyleKey = "satellite" | "nasa_viirs" | "dark" | "street";
export type InfraFilter = "all" | "power" | "roads" | "shelters" | "parametric";

/**
 * Returns yesterday's UTC date formatted YYYY-MM-DD for NASA GIBS daily WMTS tiles.
 */
export function getGibsDate(now: Date = new Date()): string {
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split("T")[0];
}

export interface MapStylesOptions {
  satelliteName?: string;
}

export function getMapStyles(
  now: Date = new Date(),
  options?: MapStylesOptions
): Record<MapStyleKey, MapStyleDefinition> {
  const gibsDate = getGibsDate(now);
  return {
    satellite: {
      name: options?.satelliteName ?? "🗺️ Esri World Imagery basemap",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: "Tiles &copy; Esri, USGS, NOAA",
    },
    nasa_viirs: {
      name: "NASA VIIRS daily imagery (prior UTC date)",
      url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${gibsDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
      attribution: "Imagery &copy; NASA EOSDIS GIBS / NOAA VIIRS",
    },
    dark: {
      name: "Tactical Disaster Command (Dark)",
      url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      attribution: "&copy; CARTO &copy; OpenStreetMap contributors",
    },
    street: {
      name: "OpenStreetMap streets",
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: "&copy; OpenStreetMap contributors",
    },
  };
}

let leafletIconsConfigured = false;

/**
 * Initializes default Leaflet marker icons once using locally bundled static assets.
 */
export function ensureLeafletDefaultIcons(): void {
  if (leafletIconsConfigured) return;
  leafletIconsConfigured = true;
  delete (L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: unknown })._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "/leaflet/marker-icon-2x.png",
    iconUrl: "/leaflet/marker-icon.png",
    shadowUrl: "/leaflet/marker-shadow.png",
  });
}
