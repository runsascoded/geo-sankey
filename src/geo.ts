import type { LatLon } from './types'

const { cos, pow, sqrt, PI } = Math

/** Longitude-degree scale factor at a reference latitude.
 *  Returns lng degrees per lat degree. */
export function lngScale(refLat: number): number {
  return 1 / cos(refLat * PI / 180)
}

/** Degrees-lat per pixel at zoom 12 for a given reference latitude. */
export function degPerPxZ12(refLat: number): number {
  const cosRef = cos(refLat * PI / 180)
  return 156543.03 * cosRef / (pow(2, 12) * 111320)
}

/** Convert pixel width to half-width in degrees of latitude. */
export function pxToHalfDeg(
  widthPx: number,
  zoom: number,
  geoScale: number,
  refLat: number,
): number {
  return (widthPx / 2) * degPerPxZ12(refLat) * pow(2, (geoScale - 1) * (zoom - 12))
}

/** Convert pixel offset to degrees of latitude (full, not halved). */
export function pxToDeg(
  px: number,
  zoom: number,
  geoScale: number,
  refLat: number,
): number {
  return px * degPerPxZ12(refLat) * pow(2, (geoScale - 1) * (zoom - 12))
}

/** Convert [lat, lon][] path to GeoJSON [lon, lat][] coordinates. */
export function toGeoJSON(path: LatLon[]): [number, number][] {
  return path.map(([lat, lon]) => [lon, lat])
}

/** Offset a path laterally (perpendicular to start→end direction). */
export function offsetPath(path: LatLon[], offset: number): LatLon[] {
  if (path.length < 2 || offset === 0) return path
  const [sLat, sLon] = path[0]
  const [eLat, eLon] = path[path.length - 1]
  const dx = eLon - sLon, dy = eLat - sLat
  const len = sqrt(dx * dx + dy * dy)
  if (len === 0) return path
  const perpLat = -dx / len
  const perpLon = dy / len
  const k = offset * 0.0004
  return path.map(([lat, lon]) => [lat + perpLat * k, lon + perpLon * k])
}
