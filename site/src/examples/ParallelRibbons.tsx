import { useMemo, useCallback, useEffect, useRef } from 'react'
import MapGL, { Source, Layer } from 'react-map-gl/maplibre'
import type { MapRef } from 'react-map-gl/maplibre'
import { smoothPath, perpAt, ribbon, ringFeature, pxToDeg } from 'geo-sankey'
import type { LatLon } from 'geo-sankey'
import { useLLZ } from '../llz'
import 'maplibre-gl/dist/maplibre-gl.css'

interface Station { id: string; name: string; pos: LatLon }
interface Route { id: string; name: string; color: string; stops: string[] }

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
]

// Order matters for shared-segment offset assignment.
// HOB-33 before JSQ-33 so blue is left of yellow on Manhattan segments.
const routes: Route[] = [
  { id: 'nwk-wtc', name: 'NWK–WTC',  color: '#d32f2f', stops: ['nwk', 'har', 'jsq', 'grove', 'ep', 'wtc'] },
  { id: 'hob-wtc', name: 'HOB–WTC',  color: '#2e7d32', stops: ['hob', 'np', 'ep', 'wtc'] },
  { id: 'hob-33',  name: 'HOB–33',   color: '#1565c0', stops: ['hob', '14th', '23rd', '33rd'] },
  { id: 'jsq-33',  name: 'JSQ–33',   color: '#f9a825', stops: ['jsq', 'grove', 'np', 'chr', '9th', '14th', '23rd', '33rd'] },
]

const stationMap = new Map(stations.map(s => [s.id, s]))

const RIBBON_W = 1.2
const GAP = 0.3

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

function offsetPathByPx(path: LatLon[], px: number, zoom: number, refLat: number): LatLon[] {
  if (px === 0) return path
  const deg = pxToDeg(px, zoom, 1, refLat)
  return path.map((pt, i) => {
    const [pLat, pLon] = perpAt(path, i)
    return [pt[0] + pLat * deg, pt[1] + pLon * deg] as LatLon
  })
}

function stationRouteColors(stationId: string): string[] {
  return routes.filter(r => r.stops.includes(stationId)).map(r => r.color)
}

/** Create a rounded-rect SVG data URL for use as a MapLibre icon */
function roundedRectSVG(w: number, h: number): string {
  const r = 4
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="${r}" ry="${r}" ` +
    `fill="white" stroke="#333" stroke-width="2"/>` +
    `</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const DEFAULTS = { lat: 40.733, lng: -74.060, zoom: 12.5 }
const REF_LAT = 40.733

export default function ParallelRibbons() {
  const [llz, setLLZ] = useLLZ(DEFAULTS)
  const mapRef = useRef<MapRef>(null)
  const offsets = useMemo(() => computeOffsets(routes), [])

  // Register rounded-rect icon on map load
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    const addIcon = () => {
      if (map.hasImage('rounded-rect')) return
      const img = new Image()
      img.onload = () => { map.addImage('rounded-rect', img) }
      img.src = roundedRectSVG(20, 16)
    }
    if (map.loaded()) addIcon()
    else map.on('load', addIcon)
  }, [])

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
          features.push(ringFeature(ring, { color: route.color, routeId: route.id, width: RIBBON_W }))
        }
      }
    }
    return { type: 'FeatureCollection' as const, features }
  }, [llz.zoom, offsets])

  const stationFeatures = useMemo(() => {
    const features = stations.map(s => {
      const colors = stationRouteColors(s.id)
      return {
        type: 'Feature' as const,
        properties: {
          name: s.name,
          isTransfer: colors.length > 1,
          routeCount: colors.length,
        },
        geometry: { type: 'Point' as const, coordinates: [s.pos[1], s.pos[0]] },
      }
    })
    return { type: 'FeatureCollection' as const, features }
  }, [])

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
          ref={mapRef}
          initialViewState={{ longitude: llz.lng, latitude: llz.lat, zoom: llz.zoom }}
          style={{ width: '100%', height: '100%' }}
          mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
          onMove={onMove}
        >
          <Source id="ribbons" type="geojson" data={ribbonFeatures}>
            <Layer
              id="ribbons-fill"
              type="fill"
              paint={{ 'fill-color': ['get', 'color'], 'fill-opacity': 0.9 }}
            />
          </Source>
          <Source id="stations" type="geojson" data={stationFeatures}>
            {/* Transfer stations: rounded rect icon */}
            <Layer
              id="station-transfer"
              type="symbol"
              filter={['==', ['get', 'isTransfer'], true]}
              layout={{
                'icon-image': 'rounded-rect',
                'icon-allow-overlap': true,
                'icon-size': 1,
              }}
            />
            {/* Simple stations: small circle */}
            <Layer
              id="station-simple"
              type="circle"
              filter={['==', ['get', 'isTransfer'], false]}
              paint={{
                'circle-radius': 4,
                'circle-color': '#fff',
                'circle-stroke-color': '#555',
                'circle-stroke-width': 1.5,
              }}
            />
            <Layer
              id="station-labels"
              type="symbol"
              layout={{
                'text-field': ['get', 'name'],
                'text-size': 11,
                'text-offset': [0, 1.3],
                'text-anchor': 'top',
                'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
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
