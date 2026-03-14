const { cos, pow, PI } = Math

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
