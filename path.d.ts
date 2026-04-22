import { LatLon } from './types';
/** Cubic bezier through four control points. */
export declare function cubicBezier(p0: LatLon, p1: LatLon, p2: LatLon, p3: LatLon, n?: number): LatLon[];
/** Catmull-Rom spline through waypoints. Returns a smooth polyline with
 *  `segsPerSpan` samples between each consecutive pair of input points.
 *  Also returns `knots`: the output indices corresponding to each input point. */
export declare function smoothPath(pts: LatLon[], segsPerSpan?: number): {
    path: LatLon[];
    knots: number[];
};
/** S-curve bezier: depart east, arrive east. */
export declare function sBezier(start: LatLon, end: LatLon): LatLon[];
/** Bezier with explicit departure and/or arrival bearings (degrees, 0=N 90=E).
 *  Undefined bearings default to east (90°). `departVelocity`/`arriveVelocity`
 *  override the default control-point distance (in scaled-degree space used
 *  internally by this function — same units as the returned path). */
export declare function directedBezier(start: LatLon, end: LatLon, departBearing?: number, arriveBearing?: number, n?: number, lngScaleFactor?: number, departVelocity?: number, arriveVelocity?: number): LatLon[];
/** Perpendicular unit vector at waypoint i (in lat/lng space, not scaled). */
export declare function perpAt(path: LatLon[], i: number): LatLon;
/** Forward unit vector at waypoint i. */
export declare function fwdAt(path: LatLon[], i: number): LatLon;
/** Perpendicular unit vector (left of bearing) in [lat, lon] space.
 *  bearing: degrees clockwise from north (0=N, 90=E, etc.) */
export declare function bearingPerpLeft(bearing: number): LatLon;
