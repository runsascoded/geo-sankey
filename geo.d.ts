import { LatLon } from './types';
/** Longitude-degree scale factor at a reference latitude.
 *  Returns lng degrees per lat degree. */
export declare function lngScale(refLat: number): number;
/** Degrees-lat per pixel at zoom 12 for a given reference latitude. */
export declare function degPerPxZ12(refLat: number): number;
/** Convert pixel width to half-width in degrees of latitude. */
export declare function pxToHalfDeg(widthPx: number, zoom: number, geoScale: number, refLat: number): number;
/** Convert pixel offset to degrees of latitude (full, not halved). */
export declare function pxToDeg(px: number, zoom: number, geoScale: number, refLat: number): number;
/** Convert [lat, lon][] path to GeoJSON [lon, lat][] coordinates. */
export declare function toGeoJSON(path: LatLon[]): [number, number][];
/** Offset a path laterally (perpendicular to start→end direction). */
export declare function offsetPath(path: LatLon[], offset: number): LatLon[];
