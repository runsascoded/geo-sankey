import type { LatLon } from './types'

const { sqrt, max, min, PI, sin, cos } = Math

/** Cubic bezier through four control points. */
export function cubicBezier(p0: LatLon, p1: LatLon, p2: LatLon, p3: LatLon, n = 20): LatLon[] {
  const pts: LatLon[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t
    pts.push([
      u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0],
      u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1],
    ])
  }
  return pts
}

/** Catmull-Rom spline through waypoints. Returns a smooth polyline with
 *  `segsPerSpan` samples between each consecutive pair of input points.
 *  Also returns `knots`: the output indices corresponding to each input point. */
export function smoothPath(pts: LatLon[], segsPerSpan = 12): { path: LatLon[]; knots: number[] } {
  const n = pts.length
  if (n < 2) return { path: [...pts], knots: pts.map((_, i) => i) }
  const out: LatLon[] = []
  const knots: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[max(i - 1, 0)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[min(i + 2, n - 1)]
    knots.push(out.length)
    for (let s = 0; s < segsPerSpan; s++) {
      const t = s / segsPerSpan, t2 = t * t, t3 = t2 * t
      out.push([
        0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ])
    }
  }
  knots.push(out.length)
  out.push(pts[n - 1])
  return { path: out, knots }
}

/** S-curve bezier: depart east, arrive east. */
export function sBezier(start: LatLon, end: LatLon): LatLon[] {
  const dLon = end[1] - start[1]
  const dLat = end[0] - start[0]
  const dist = sqrt(dLat * dLat + dLon * dLon)
  const span = max(Math.abs(dLon) * 0.5, dist * 0.35)
  const cp1: LatLon = [start[0], start[1] + span]
  const cp2: LatLon = [end[0], end[1] - span]
  return cubicBezier(start, cp1, cp2, end)
}

/** Bezier with explicit departure and/or arrival bearings (degrees, 0=N 90=E).
 *  Undefined bearings default to east (90°). */
export function directedBezier(
  start: LatLon,
  end: LatLon,
  departBearing?: number,
  arriveBearing?: number,
  n = 20,
  lngScaleFactor = 1,
): LatLon[] {
  // Work in Mercator-like screen space (lon, lat*ls) where angles
  // are preserved. Scale lat by ls so index 0 = lat*ls ≈ screen y.
  const ls = lngScaleFactor
  const sStart: LatLon = [start[0] * ls, start[1]]
  const sEnd: LatLon = [end[0] * ls, end[1]]

  const dLat = sEnd[0] - sStart[0], dLon = sEnd[1] - sStart[1]
  const dist = sqrt(dLat * dLat + dLon * dLon)

  const pathAngle = Math.atan2(dLon, dLat) * 180 / PI

  const dRad = (departBearing ?? 90) * PI / 180
  const dDiff = Math.abs(((((departBearing ?? 90) - pathAngle) % 360) + 540) % 360 - 180)
  const dSpan = max(dist * (dDiff < 90 ? 0.4 : 0.2), 0.001)
  const cp1: LatLon = [sStart[0] + cos(dRad) * dSpan, sStart[1] + sin(dRad) * dSpan]

  const aRad = (arriveBearing ?? 90) * PI / 180
  const aDiff = Math.abs(((((arriveBearing ?? 90) - pathAngle) % 360) + 540) % 360 - 180)
  const aSpan = max(dist * (aDiff < 90 ? 0.4 : 0.2), 0.001)
  const cp2: LatLon = [sEnd[0] - cos(aRad) * aSpan, sEnd[1] - sin(aRad) * aSpan]

  const scaled = cubicBezier(sStart, cp1, cp2, sEnd, n)

  // Replace second and second-to-last bezier points with positions along
  // the exact bearing. The segment from this forced point to the endpoint
  // is at exact bearing, ensuring the offset curve perpendicular there
  // matches the node's bearing for seamless crease plugging.
  if (scaled.length >= 4) {
    const seg0Lat = scaled[1][0] - scaled[0][0]
    const seg0Lon = scaled[1][1] - scaled[0][1]
    const seg0Len = sqrt(seg0Lat * seg0Lat + seg0Lon * seg0Lon)
    scaled[1] = [sStart[0] + cos(dRad) * seg0Len, sStart[1] + sin(dRad) * seg0Len]

    const last = scaled.length - 1
    const segNLat = scaled[last][0] - scaled[last - 1][0]
    const segNLon = scaled[last][1] - scaled[last - 1][1]
    const segNLen = sqrt(segNLat * segNLat + segNLon * segNLon)
    scaled[last - 1] = [sEnd[0] - cos(aRad) * segNLen, sEnd[1] - sin(aRad) * segNLen]
  }

  // Unscale lat back from screen space
  return scaled.map(p => [p[0] / ls, p[1]] as LatLon)
}

/** Perpendicular unit vector at waypoint i (in lat/lng space, not scaled). */
export function perpAt(path: LatLon[], i: number): LatLon {
  const n = path.length
  let dy = 0, dx = 0
  if (i < n - 1) { dy += path[i + 1][0] - path[i][0]; dx += path[i + 1][1] - path[i][1] }
  if (i > 0) { dy += path[i][0] - path[i - 1][0]; dx += path[i][1] - path[i - 1][1] }
  const len = sqrt(dy * dy + dx * dx)
  if (len === 0) return [0, 0]
  return [-dx / len, dy / len]  // rotate 90° CCW
}

/** Forward unit vector at waypoint i. */
export function fwdAt(path: LatLon[], i: number): LatLon {
  const n = path.length
  const next = min(i + 1, n - 1), prev = max(i - 1, 0)
  const dy = path[next][0] - path[prev][0], dx = path[next][1] - path[prev][1]
  const len = sqrt(dy * dy + dx * dx)
  if (len === 0) return [0, 0]
  return [dy / len, dx / len]
}

/** Perpendicular unit vector (left of bearing) in [lat, lon] space.
 *  bearing: degrees clockwise from north (0=N, 90=E, etc.) */
export function bearingPerpLeft(bearing: number): LatLon {
  const rad = bearing * PI / 180
  return [sin(rad), -cos(rad)]
}
