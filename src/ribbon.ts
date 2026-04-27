import type { LatLon } from './types'
import { lngScale } from './geo'
import { perpAt, fwdAt } from './path'

const { sqrt, max, min, ceil, PI } = Math

/** Default `wing` / `angle` for arrowhead geometry. Demo + downstream
 *  apps converged on these values; they read more "arrowy" than the
 *  prior `0.4 / 45°` defaults. Pass `wing = 0.4, angle = 45` explicitly
 *  for the spear-shaped earlier look. */
export const DEFAULT_WING = 0.65
export const DEFAULT_ANGLE = 60

/** Compute `arrowWingFactor` / `arrowLenFactor` from a `wing` / `angle`
 *  pair. Use this when calling the bare `ribbonArrow*` helpers so the
 *  result matches the `FlowGraph*` codepath. */
export function resolveArrowDefaults(opts: { wing?: number; angle?: number } = {}):
  { arrowWingFactor: number; arrowLenFactor: number } {
  const wing = opts.wing ?? DEFAULT_WING
  const angle = opts.angle ?? DEFAULT_ANGLE
  const arrowWingFactor = 1 + 2 * wing
  // angle = internal angle at each wingtip (between wing edge and base line)
  // tan(angle) = arrowH / wingW, where wingW = arrowWingFactor * halfW
  // arrowLenFactor = arrowH / (2 * halfW) = arrowWingFactor * tan(angle) / 2
  const arrowLenFactor = arrowWingFactor * Math.tan(angle * PI / 180) / 2
  return { arrowWingFactor, arrowLenFactor }
}

export interface RibbonArrowOpts {
  /** Optional: omit to use lib defaults (`wing = 0.65, angle = 60`). */
  arrowWingFactor?: number
  arrowLenFactor?: number
  widthPx?: number
  /** Max fraction of path length the arrow can occupy. Default 0.4. */
  maxArrowFraction?: number
}

/** Build a ribbon polygon with integrated arrowhead.
 *  Returns GeoJSON [lng, lat][] ring (closed). */
export function ribbonArrow(
  path: LatLon[],
  halfW: number,
  refLat: number,
  opts: RibbonArrowOpts = {},
): [number, number][] {
  const defaults = resolveArrowDefaults()
  const arrowWingFactor = opts.arrowWingFactor ?? defaults.arrowWingFactor
  const arrowLenFactor = opts.arrowLenFactor ?? defaults.arrowLenFactor
  const { widthPx } = opts
  const n = path.length
  if (n < 2) return []
  const cumLen = [0]
  for (let i = 1; i < n; i++) {
    const dy = path[i][0] - path[i - 1][0], dx = path[i][1] - path[i - 1][1]
    cumLen.push(cumLen[i - 1] + sqrt(dy * dy + dx * dx))
  }
  const pathLen = cumLen[n - 1]
  const desiredArrowLen = halfW * 2 * arrowLenFactor
  const arrowLen = min(desiredArrowLen, pathLen * (opts.maxArrowFraction ?? 0.4))
  const arrowScale = desiredArrowLen > 0 ? arrowLen / desiredArrowLen : 1
  const effectiveWing = widthPx != null && widthPx < 8
    ? arrowWingFactor + (8 - widthPx) * 0.15
    : arrowWingFactor
  const arrowHalfW = halfW * (1 + (effectiveWing - 1) * arrowScale)
  const ls = lngScale(refLat)

  const baseDist = pathLen - arrowLen

  const avgStart = max(0, n - 1 - ceil(n * 0.25))
  let fwdLat = path[n - 1][0] - path[avgStart][0]
  let fwdLon = path[n - 1][1] - path[avgStart][1]
  const fwdLen = sqrt(fwdLat * fwdLat + fwdLon * fwdLon)
  if (fwdLen > 0) { fwdLat /= fwdLen; fwdLon /= fwdLen }
  else { fwdLat = fwdAt(path, n - 1)[0]; fwdLon = fwdAt(path, n - 1)[1] }
  const pLat = -fwdLon, pLng = fwdLat

  const baseLat = path[n - 1][0] - fwdLat * arrowLen
  const baseLng = path[n - 1][1] - fwdLon * arrowLen

  const left: [number, number][] = []
  const right: [number, number][] = []

  for (let i = 0; i < n; i++) {
    if (cumLen[i] > baseDist) break
    const [pL, pN] = perpAt(path, i)
    left.push([path[i][1] + pN * halfW * ls, path[i][0] + pL * halfW])
    right.push([path[i][1] - pN * halfW * ls, path[i][0] - pL * halfW])
  }

  left.push([baseLng + pLng * halfW * ls, baseLat + pLat * halfW])
  right.push([baseLng - pLng * halfW * ls, baseLat - pLat * halfW])
  left.push([baseLng + pLng * arrowHalfW * ls, baseLat + pLat * arrowHalfW])
  right.push([baseLng - pLng * arrowHalfW * ls, baseLat - pLat * arrowHalfW])

  const tip: [number, number] = [path[n - 1][1], path[n - 1][0]]

  const ring = [...left, tip, ...right.reverse()]
  ring.push(ring[0])
  return ring
}

/** Build a ribbon polygon WITHOUT arrowhead. */
export function ribbon(path: LatLon[], halfW: number, refLat: number): [number, number][] {
  const n = path.length
  if (n < 2) return []
  const ls = lngScale(refLat)
  const left: [number, number][] = []
  const right: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const [pLat, pLng] = perpAt(path, i)
    left.push([path[i][1] + pLng * halfW * ls, path[i][0] + pLat * halfW])
    right.push([path[i][1] - pLng * halfW * ls, path[i][0] - pLat * halfW])
  }
  const ring = [...left, ...right.reverse()]
  ring.push(ring[0])
  return ring
}

/** Return left/right edges separately (same direction as path), without closing into a ring. */
export function ribbonEdges(path: LatLon[], halfW: number, refLat: number): {
  left: [number, number][]
  right: [number, number][]
} {
  const n = path.length
  if (n < 2) return { left: [], right: [] }
  const ls = lngScale(refLat)
  const left: [number, number][] = []
  const right: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const [pLat, pLng] = perpAt(path, i)
    left.push([path[i][1] + pLng * halfW * ls, path[i][0] + pLat * halfW])
    right.push([path[i][1] - pLng * halfW * ls, path[i][0] - pLat * halfW])
  }
  return { left, right }
}

/** Return left/right edges and arrow tip separately for stitching into a single polygon. */
export function ribbonArrowEdges(path: LatLon[], halfW: number, refLat: number, opts: RibbonArrowOpts = {}): {
  left: [number, number][]
  right: [number, number][]
  tip: [number, number]
} {
  const defaults = resolveArrowDefaults()
  const arrowWingFactor = opts.arrowWingFactor ?? defaults.arrowWingFactor
  const arrowLenFactor = opts.arrowLenFactor ?? defaults.arrowLenFactor
  const { widthPx } = opts
  const n = path.length
  if (n < 2) return { left: [], right: [], tip: [0, 0] }
  const cumLen = [0]
  for (let i = 1; i < n; i++) {
    const dy = path[i][0] - path[i - 1][0], dx = path[i][1] - path[i - 1][1]
    cumLen.push(cumLen[i - 1] + sqrt(dy * dy + dx * dx))
  }
  const pathLen = cumLen[n - 1]
  const desiredArrowLen = halfW * 2 * arrowLenFactor
  const arrowLen = min(desiredArrowLen, pathLen * (opts.maxArrowFraction ?? 0.4))
  const arrowScale = desiredArrowLen > 0 ? arrowLen / desiredArrowLen : 1
  const effectiveWing = widthPx != null && widthPx < 8
    ? arrowWingFactor + (8 - widthPx) * 0.15
    : arrowWingFactor
  const arrowHalfW = halfW * (1 + (effectiveWing - 1) * arrowScale)
  const ls = lngScale(refLat)

  const baseDist = pathLen - arrowLen

  const avgStart = max(0, n - 1 - ceil(n * 0.25))
  let fwdLat = path[n - 1][0] - path[avgStart][0]
  let fwdLon = path[n - 1][1] - path[avgStart][1]
  const fwdLen = sqrt(fwdLat * fwdLat + fwdLon * fwdLon)
  if (fwdLen > 0) { fwdLat /= fwdLen; fwdLon /= fwdLen }
  else { fwdLat = fwdAt(path, n - 1)[0]; fwdLon = fwdAt(path, n - 1)[1] }
  const pLat = -fwdLon, pLng = fwdLat

  const baseLat = path[n - 1][0] - fwdLat * arrowLen
  const baseLng = path[n - 1][1] - fwdLon * arrowLen

  const left: [number, number][] = []
  const right: [number, number][] = []

  for (let i = 0; i < n; i++) {
    if (cumLen[i] > baseDist) break
    const [pL, pN] = perpAt(path, i)
    left.push([path[i][1] + pN * halfW * ls, path[i][0] + pL * halfW])
    right.push([path[i][1] - pN * halfW * ls, path[i][0] - pL * halfW])
  }

  left.push([baseLng + pLng * halfW * ls, baseLat + pLat * halfW])
  right.push([baseLng - pLng * halfW * ls, baseLat - pLat * halfW])
  left.push([baseLng + pLng * arrowHalfW * ls, baseLat + pLat * arrowHalfW])
  right.push([baseLng - pLng * arrowHalfW * ls, baseLat - pLat * arrowHalfW])

  const tip: [number, number] = [path[n - 1][1], path[n - 1][0]]

  return { left, right, tip }
}

/** Wrap a [lng, lat][] ring as a GeoJSON Polygon Feature. */
export function ringFeature<P>(
  ring: [number, number][],
  properties: P,
): GeoJSON.Feature<GeoJSON.Polygon, P> {
  return {
    type: 'Feature',
    properties,
    geometry: { type: 'Polygon', coordinates: [ring] },
  }
}
