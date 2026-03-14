import { useMemo, useCallback } from 'react'
import MapGL, { Source, Layer } from 'react-map-gl/maplibre'
import { smoothPath, perpAt, ribbon, ringFeature, pxToDeg } from 'geo-sankey'
import type { LatLon } from 'geo-sankey'
import { useLLZ } from '../llz'
import 'maplibre-gl/dist/maplibre-gl.css'

interface Station { id: string; name: string; pos: LatLon }
interface Route { id: string; name: string; color: string; stops: string[] }

const stations: Station[] = [
  { id: 'grove',    name: 'Grove St',        pos: [40.7191, -74.0431] },
  { id: 'exchange', name: 'Exchange Place',   pos: [40.7163, -74.0327] },
  { id: 'hamilton', name: 'Hamilton Park',    pos: [40.7275, -74.0461] },
  { id: 'newport',  name: 'Newport',          pos: [40.7268, -74.0340] },
  { id: 'hoboken',  name: 'Hoboken Terminal', pos: [40.7355, -74.0298] },
  { id: 'vanvorst', name: 'Van Vorst Park',   pos: [40.7201, -74.0480] },
  { id: 'jsq',      name: 'Journal Square',   pos: [40.7328, -74.0629] },
]

const routes: Route[] = [
  { id: 'a', name: 'Heights Express',    color: '#dc2626', stops: ['jsq', 'hamilton', 'newport', 'hoboken'] },
  { id: 'b', name: 'Waterfront Loop',    color: '#2563eb', stops: ['grove', 'hamilton', 'newport', 'exchange'] },
  { id: 'c', name: 'Downtown Connector', color: '#059669', stops: ['vanvorst', 'grove', 'hamilton', 'hoboken'] },
]

const stationMap = new Map(stations.map(s => [s.id, s]))

const RIBBON_W = 0.7 // px per route ribbon (at zoom 12; ~4px on screen at z14.5)
const GAP = 0.2      // px gap between ribbons

function segKey(a: string, b: string) {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

/** Compute per-segment route offsets (px from center). */
function computeOffsets(routes: Route[]) {
  // Group routes by segment
  const segRoutes = new Map<string, string[]>()
  for (const route of routes) {
    for (let i = 0; i < route.stops.length - 1; i++) {
      const key = segKey(route.stops[i], route.stops[i + 1])
      const arr = segRoutes.get(key) ?? []
      if (!arr.includes(route.id)) arr.push(route.id)
      segRoutes.set(key, arr)
    }
  }
  // Assign offsets: center the group
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

/** Offset a smoothed path by px pixels perpendicular to its direction. */
function offsetPathByPx(
  path: LatLon[],
  px: number,
  zoom: number,
  refLat: number,
): LatLon[] {
  if (px === 0) return path
  const deg = pxToDeg(px, zoom, 1, refLat)
  return path.map((pt, i) => {
    const [pLat, pLon] = perpAt(path, i)
    return [pt[0] + pLat * deg, pt[1] + pLon * deg] as LatLon
  })
}

const DEFAULTS = { lat: 40.726, lng: -74.043, zoom: 14.5 }
const REF_LAT = 40.726

export default function ParallelRibbons() {
  const [llz, setLLZ] = useLLZ(DEFAULTS)

  const offsets = useMemo(() => computeOffsets(routes), [])

  const ribbonFeatures = useMemo(() => {
    const features: GeoJSON.Feature[] = []
    const halfW = pxToDeg(RIBBON_W, llz.zoom, 1, REF_LAT) / 2
    for (const route of routes) {
      for (let i = 0; i < route.stops.length - 1; i++) {
        const a = stationMap.get(route.stops[i])!
        const b = stationMap.get(route.stops[i + 1])!
        const key = segKey(route.stops[i], route.stops[i + 1])
        const offsetPx = offsets.get(key)?.get(route.id) ?? 0
        const { path: smooth } = smoothPath([a.pos, b.pos], 16)
        const offsetSmooth = offsetPathByPx(smooth, offsetPx, llz.zoom, REF_LAT)
        const ring = ribbon(offsetSmooth, halfW, REF_LAT)
        if (ring.length) {
          features.push(ringFeature(ring, {
            color: route.color,
            routeId: route.id,
            width: RIBBON_W,
          }))
        }
      }
    }
    return { type: 'FeatureCollection' as const, features }
  }, [llz.zoom, offsets])

  const stationFeatures = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: stations.map(s => ({
      type: 'Feature' as const,
      properties: { name: s.name },
      geometry: { type: 'Point' as const, coordinates: [s.pos[1], s.pos[0]] },
    })),
  }), [])

  const onMove = useCallback((e: { viewState: { longitude: number; latitude: number; zoom: number } }) => {
    setLLZ({ lat: e.viewState.latitude, lng: e.viewState.longitude, zoom: e.viewState.zoom })
  }, [setLLZ])

  return (
    <div className="example">
      <h2>Parallel Ribbons</h2>
      <p>Multiple named routes running side-by-side on shared segments, like a transit or bike bus map.</p>
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
          mapStyle="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
          onMove={onMove}
        >
          <Source id="ribbons" type="geojson" data={ribbonFeatures}>
            <Layer
              id="ribbons-fill"
              type="fill"
              paint={{
                'fill-color': ['get', 'color'],
                'fill-opacity': 0.9,
              }}
            />
            <Layer
              id="ribbons-outline"
              type="line"
              paint={{
                'line-color': ['get', 'color'],
                'line-width': 0.3,
                'line-opacity': 0.5,
              }}
            />
          </Source>
          <Source id="stations" type="geojson" data={stationFeatures}>
            <Layer
              id="station-circles"
              type="circle"
              paint={{
                'circle-radius': 5,
                'circle-color': '#fff',
                'circle-stroke-color': '#333',
                'circle-stroke-width': 2,
              }}
            />
            <Layer
              id="station-labels"
              type="symbol"
              layout={{
                'text-field': ['get', 'name'],
                'text-size': 12,
                'text-offset': [0, 1.5],
                'text-anchor': 'top',
              }}
              paint={{
                'text-color': '#333',
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
