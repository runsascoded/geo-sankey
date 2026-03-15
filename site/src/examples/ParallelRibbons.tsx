import { useMemo, useCallback } from 'react'
import MapGL, { Source, Layer } from 'react-map-gl/maplibre'
import { perpAt, ribbon, ringFeature, pxToDeg } from 'geo-sankey'
import type { LatLon } from 'geo-sankey'
import { useLLZ } from '../llz'
import 'maplibre-gl/dist/maplibre-gl.css'

interface Station { id: string; name: string; pos: LatLon; waypoint?: boolean }
interface Route {
  id: string
  name: string
  color: string
  stops: string[]
}

const stations: Station[] = [
  { id: 'nwk',   name: 'Newark',            pos: [40.7355, -74.1640] },
  { id: 'har',   name: 'Harrison',          pos: [40.7393, -74.1558] },
  { id: 'jsq',   name: 'Journal Square',    pos: [40.7328, -74.0629] },
  { id: 'grove', name: 'Grove Street',      pos: [40.7191, -74.0431] },
  { id: 'ep',    name: 'Exchange Place',     pos: [40.7163, -74.0327] },
  { id: 'np',    name: 'Pavonia/Newport',   pos: [40.7268, -74.0340] },
  { id: 'wtc',   name: 'World Trade Center', pos: [40.7115, -74.0104] },
  { id: 'hob',   name: 'Hoboken',           pos: [40.7355, -74.0298] },
  { id: 'chr',   name: 'Christopher St',    pos: [40.7329, -74.0070] },
  { id: '9th',   name: '9th Street',        pos: [40.7342, -74.0005] },
  { id: '14th',  name: '14th Street',       pos: [40.7375, -73.9969] },
  { id: '23rd',  name: '23rd Street',       pos: [40.7428, -73.9928] },
  { id: '33rd',  name: '33rd Street',       pos: [40.7490, -73.9884] },
  // Waypoints: invisible routing nodes for topology and path shaping
  { id: 'hob_w',  name: '', pos: [40.7358, -74.0370], waypoint: true },  // west of HOB, B+G exit
  { id: 'hob_s',  name: '', pos: [40.7290, -74.0370], waypoint: true },  // south turn, B/G split
  { id: 'riv_w',  name: '', pos: [40.7290, -74.0250], waypoint: true },  // NJ tunnel mouth, B+Y shared
]

// Order matters: determines left-to-right stacking on shared segments.
const routes: Route[] = [
  {
    id: 'nwk-wtc', name: 'NWK–WTC', color: '#d32f2f',
    stops: ['nwk', 'har', 'jsq', 'grove', 'ep', 'wtc'],
  },
  {
    id: 'hob-wtc', name: 'HOB–WTC', color: '#2e7d32',
    stops: ['hob', 'hob_w', 'hob_s', 'np', 'ep', 'wtc'],
  },
  {
    id: 'jsq-33', name: 'JSQ–33', color: '#f9a825',
    stops: ['jsq', 'grove', 'np', 'riv_w', 'chr', '9th', '14th', '23rd', '33rd'],
  },
  {
    id: 'hob-33', name: 'HOB–33', color: '#1565c0',
    stops: ['hob', 'hob_w', 'hob_s', 'riv_w', 'chr', '9th', '14th', '23rd', '33rd'],
  },
]

const stationMap = new Map(stations.map(s => [s.id, s]))

const RIBBON_W = 2.0
const GAP = 0.5
const CORNER_RADIUS = 0 // TEST: no arcs, just straight lines

function segKey(a: string, b: string) {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

function computeOffsets(rts: Route[]) {
  const segRoutes = new Map<string, string[]>()
  for (const route of rts) {
    for (let i = 0; i < route.stops.length - 1; i++) {
      const key = segKey(route.stops[i], route.stops[i + 1])
      const arr = segRoutes.get(key) ?? []
      if (!arr.includes(route.id)) arr.push(route.id)
      segRoutes.set(key, arr)
    }
  }
  const offsets = new Map<string, Map<string, number>>()
  for (const [key, routeIds] of segRoutes) {
    const n = routeIds.length
    const totalW = n * RIBBON_W + (n - 1) * GAP
    const routeOffsets = new Map<string, number>()
    for (let i = 0; i < n; i++) {
      routeOffsets.set(routeIds[i], -totalW / 2 + RIBBON_W / 2 + i * (RIBBON_W + GAP))
    }
    offsets.set(key, routeOffsets)
  }
  return offsets
}

function stationRouteColors(stationId: string): string[] {
  return routes.filter(r => r.stops.includes(stationId)).map(r => r.color)
}

const DEFAULTS = { lat: 40.733, lng: -74.060, zoom: 12.5 }
const REF_LAT = 40.733
const COS_LAT = Math.cos(REF_LAT * Math.PI / 180)

/** Build a polyline with straight segments and circular arcs at corners.
 *  radius is in degrees latitude. Works in cos(lat)-scaled coords internally. */
function roundedPath(pts: LatLon[], radius: number, segsPerArc = 10): { path: LatLon[]; knots: number[] } {
  const n = pts.length
  if (n < 2) return { path: [...pts], knots: pts.map((_, i) => i) }
  if (n === 2) return { path: [...pts], knots: [0, 1] }
  const { sqrt, atan2, cos, sin, PI, max, min, acos } = Math

  // Scale to uniform coords [lat, lon*cosLat]
  const sc = pts.map(p => [p[0], p[1] * COS_LAT] as [number, number])

  // Compute arc data for each interior point
  type ArcData = { T1: [number, number]; T2: [number, number]; C: [number, number]; a1: number; sweep: number; r: number } | null
  const arcs: ArcData[] = []

  for (let i = 1; i < n - 1; i++) {
    const A = sc[i - 1], P = sc[i], B = sc[i + 1]
    const d1 = [P[0] - A[0], P[1] - A[1]]
    const d2 = [B[0] - P[0], B[1] - P[1]]
    const len1 = sqrt(d1[0] ** 2 + d1[1] ** 2)
    const len2 = sqrt(d2[0] ** 2 + d2[1] ** 2)

    if (len1 < 1e-10 || len2 < 1e-10) { arcs.push(null); continue }

    const u1 = [d1[0] / len1, d1[1] / len1]
    const u2 = [d2[0] / len2, d2[1] / len2]
    const dot = u1[0] * u2[0] + u1[1] * u2[1]
    const halfAngle = acos(max(-1, min(1, dot))) / 2

    if (halfAngle < 0.01) { arcs.push(null); continue }

    let t = radius / Math.tan(halfAngle)
    const maxT = min(len1 * 0.45, len2 * 0.45)
    if (t > maxT) t = maxT
    const r = t * Math.tan(halfAngle)

    const T1: [number, number] = [P[0] - u1[0] * t, P[1] - u1[1] * t]
    const T2: [number, number] = [P[0] + u2[0] * t, P[1] + u2[1] * t]

    const cross = u1[0] * u2[1] - u1[1] * u2[0]
    const sgn = cross > 0 ? 1 : -1
    const norm = [-u1[1] * sgn, u1[0] * sgn]
    const C: [number, number] = [T1[0] + norm[0] * r, T1[1] + norm[1] * r]

    const a1 = atan2(T1[1] - C[1], T1[0] - C[0])
    const a2 = atan2(T2[1] - C[1], T2[0] - C[0])
    let sweep = a2 - a1
    if (sgn > 0) { while (sweep > 0) sweep -= 2 * PI }
    else { while (sweep < 0) sweep += 2 * PI }

    arcs.push({ T1, T2, C, a1, sweep, r })
  }

  // Build output polyline and track knot indices (where each input point maps to)
  const out: [number, number][] = []
  const knots: number[] = []

  // First point
  knots.push(out.length)
  out.push(sc[0])

  for (let i = 0; i < arcs.length; i++) {
    const arc = arcs[i]
    if (!arc || arc.r === 0) {
      // No arc: just add the corner point
      knots.push(out.length)
      out.push(sc[i + 1])
    } else {
      // Add tangent point T1 (end of incoming straight)
      out.push(arc.T1)
      // Knot at midpoint of arc
      const arcStart = out.length
      for (let s = 1; s < segsPerArc; s++) {
        const a = arc.a1 + arc.sweep * (s / segsPerArc)
        out.push([arc.C[0] + cos(a) * arc.r, arc.C[1] + sin(a) * arc.r])
      }
      knots.push(arcStart + Math.floor(segsPerArc / 2))
      // Add tangent point T2 (start of outgoing straight)
      out.push(arc.T2)
    }
  }

  // Last point
  knots.push(out.length)
  out.push(sc[n - 1])

  // Unscale back to lat/lon
  const path = out.map(p => [p[0], p[1] / COS_LAT] as LatLon)
  return { path, knots }
}

/** Build a rotated rounded-rect polygon in geographic coords. */
function geoRoundedRect(
  pos: LatLon, halfW: number, halfH: number, r: number, angle: number, cosLat: number,
): [number, number][] {
  const { cos, sin, PI } = Math
  const segs = 6
  const rawPts: [number, number][] = []
  const corners: [number, number, number][] = [
    [halfW - r, -halfH + r, -PI / 2],
    [halfW - r, halfH - r, 0],
    [-halfW + r, halfH - r, PI / 2],
    [-halfW + r, -halfH + r, PI],
  ]
  for (const [cx, cy, startA] of corners) {
    for (let i = 0; i <= segs; i++) {
      const a = startA + (PI / 2) * (i / segs)
      rawPts.push([cx + cos(a) * r, cy + sin(a) * r])
    }
  }
  rawPts.push(rawPts[0])
  const [lat, lon] = pos
  const ca = cos(angle), sa = sin(angle)
  return rawPts.map(([x, y]) => {
    const rx = x * ca - y * sa
    const ry = x * sa + y * ca
    return [lon + rx / cosLat, lat + ry] as [number, number]
  })
}

/** Compute average route bearing at a station (radians, 0=east, CCW). */
function stationBearing(stationId: string): number {
  const { atan2 } = Math
  let sumDx = 0, sumDy = 0
  for (const route of routes) {
    const idx = route.stops.indexOf(stationId)
    if (idx < 0) continue
    const prev = idx > 0 ? stationMap.get(route.stops[idx - 1]) : null
    const next = idx < route.stops.length - 1 ? stationMap.get(route.stops[idx + 1]) : null
    const here = stationMap.get(stationId)!
    if (next) {
      sumDy += next.pos[0] - here.pos[0]
      sumDx += (next.pos[1] - here.pos[1]) * COS_LAT
    }
    if (prev) {
      sumDy += here.pos[0] - prev.pos[0]
      sumDx += (here.pos[1] - prev.pos[1]) * COS_LAT
    }
  }
  return atan2(sumDy, sumDx)
}

export default function ParallelRibbons() {
  const [llz, setLLZ] = useLLZ(DEFAULTS)
  const offsets = useMemo(() => computeOffsets(routes), [])

  const ribbonFeatures = useMemo(() => {
    const features: GeoJSON.Feature[] = []
    const halfW = pxToDeg(RIBBON_W, llz.zoom, 1, REF_LAT) / 2
    for (const route of routes) {
      // Build full rounded path, then split at knots for per-segment ribbons
      const allPts: LatLon[] = route.stops.map(id => stationMap.get(id)!.pos)
      const { path: rounded, knots } = roundedPath(allPts, CORNER_RADIUS)

      for (let i = 0; i < route.stops.length - 1; i++) {
        const key = segKey(route.stops[i], route.stops[i + 1])
        const offsetPx = offsets.get(key)?.get(route.id) ?? 0
        // Extract sub-path for this segment (knots[i] to knots[i+1])
        const subPath = rounded.slice(knots[i], knots[i + 1] + 1)
        if (subPath.length < 2) continue
        // Apply constant offset
        let offsetSub = subPath
        if (offsetPx !== 0) {
          const deg = pxToDeg(offsetPx, llz.zoom, 1, REF_LAT)
          offsetSub = subPath.map((pt, j) => {
            const [pLat, pLon] = perpAt(subPath, j)
            return [pt[0] + pLat * deg, pt[1] + pLon * deg] as LatLon
          })
        }
        const ring = ribbon(offsetSub, halfW, REF_LAT)
        if (ring.length) {
          features.push(ringFeature(ring, { color: route.color, routeId: route.id, width: RIBBON_W }))
        }
      }
    }
    return { type: 'FeatureCollection' as const, features }
  }, [llz.zoom, offsets])

  const { transferRects, stationPoints } = useMemo(() => {
    const pad = pxToDeg(RIBBON_W * 0.5, llz.zoom, 1, REF_LAT)
    const rects: GeoJSON.Feature[] = []
    const points: GeoJSON.Feature[] = []

    for (const s of stations) {
      if (s.waypoint) continue
      const nRoutes = stationRouteColors(s.id).length
      const isTransfer = nRoutes > 1
      if (isTransfer) {
        const bundleH = nRoutes * RIBBON_W + (nRoutes - 1) * GAP
        const halfH = pxToDeg(bundleH / 2, llz.zoom, 1, REF_LAT) + pad
        const halfW = halfH * 1.8
        const r = halfH * 0.5
        const angle = stationBearing(s.id) + Math.PI / 2
        rects.push({
          type: 'Feature',
          properties: { name: s.name },
          geometry: { type: 'Polygon', coordinates: [geoRoundedRect(s.pos, halfW, halfH, r, angle, COS_LAT)] },
        })
      }
      points.push({
        type: 'Feature',
        properties: { name: s.name, isTransfer },
        geometry: { type: 'Point', coordinates: [s.pos[1], s.pos[0]] },
      })
    }
    return {
      transferRects: { type: 'FeatureCollection' as const, features: rects },
      stationPoints: { type: 'FeatureCollection' as const, features: points },
    }
  }, [llz.zoom])

  const onMove = useCallback((e: { viewState: { longitude: number; latitude: number; zoom: number } }) => {
    setLLZ({ lat: e.viewState.latitude, lng: e.viewState.longitude, zoom: e.viewState.zoom })
  }, [setLLZ])

  return (
    <div className="example">
      <h2>PATH System</h2>
      <p>Parallel ribbons showing the PATH rapid transit routes between New Jersey and Manhattan.</p>
      <div className="legend">
        {routes.map(r => (
          <span key={r.id} className="legend-item">
            <span className="legend-swatch" style={{ background: r.color }} />
            {r.name}
          </span>
        ))}
      </div>
      <div className="map-container">
        <MapGL
          initialViewState={{ longitude: llz.lng, latitude: llz.lat, zoom: llz.zoom }}
          style={{ width: '100%', height: '100%' }}
          mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
          onMove={onMove}
        >
          <Source id="ribbons" type="geojson" data={ribbonFeatures}>
            <Layer
              id="ribbons-fill"
              type="fill"
              paint={{ 'fill-color': ['get', 'color'], 'fill-opacity': 0.95 }}
            />
          </Source>
          <Source id="transfer-rects" type="geojson" data={transferRects}>
            <Layer
              id="transfer-rect-fill"
              type="fill"
              paint={{ 'fill-color': '#fff', 'fill-opacity': 1 }}
            />
            <Layer
              id="transfer-rect-outline"
              type="line"
              paint={{ 'line-color': '#222', 'line-width': 2 }}
            />
          </Source>
          <Source id="stations" type="geojson" data={stationPoints}>
            <Layer
              id="station-simple"
              type="circle"
              filter={['==', ['get', 'isTransfer'], false]}
              paint={{
                'circle-radius': 4,
                'circle-color': '#222',
                'circle-stroke-color': '#fff',
                'circle-stroke-width': 1.5,
              }}
            />
            <Layer
              id="station-labels"
              type="symbol"
              layout={{
                'text-field': ['get', 'name'],
                'text-size': 11,
                'text-offset': [0, 1.4],
                'text-anchor': 'top',
                'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'],
              }}
              paint={{
                'text-color': '#222',
                'text-halo-color': '#fff',
                'text-halo-width': 1.5,
              }}
            />
          </Source>
        </MapGL>
      </div>
    </div>
  )
}
