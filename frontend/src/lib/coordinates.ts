/** Format source coordinates without inventing a hemisphere for missing values. */
export function formatCoordinates(lat: number | null | undefined, lon: number | null | undefined): string {
  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return "Not available";
  return `${Math.abs(lat).toFixed(1)}°${lat < 0 ? "S" : "N"}, ${Math.abs(lon).toFixed(1)}°${lon < 0 ? "W" : "E"}`;
}
