import { useMemo, useCallback } from 'react'
import Map, { Source, Layer } from 'react-map-gl/maplibre'
import { renderFlows } from 'geo-sankey'
import type { FlowTree, RenderFlowTreeOpts } from 'geo-sankey'
import { useLLZ } from '../llz'
import 'maplibre-gl/dist/maplibre-gl.css'

/** Multiple flow trees converging on destinations across the Hudson. */
const trees: (FlowTree & { color: string })[] = [
  {
    dest: 'Penn Station',
    destPos: [40.7505, -73.9935],
    color: '#dc2626',
    root: {
      type: 'merge',
      pos: [40.758, -74.008],
      bearing: 110,
      children: [
        { type: 'source', label: 'Lincoln Tunnel', pos: [40.764, -74.022], weight: 80 },
        { type: 'source', label: 'Weehawken Ferry', pos: [40.769, -74.015], weight: 20 },
      ],
    },
  },
  {
    dest: 'World Trade Center',
    destPos: [40.7127, -74.0134],
    color: '#2563eb',
    root: {
      type: 'merge',
      pos: [40.726, -74.028],
      bearing: 130,
      children: [
        { type: 'source', label: 'Holland Tunnel', pos: [40.728, -74.048], weight: 60 },
        { type: 'source', label: 'PATH Journal Sq', pos: [40.733, -74.063], weight: 40 },
        { type: 'source', label: 'PATH Hoboken', pos: [40.738, -74.030], weight: 35 },
      ],
    },
  },
  {
    dest: 'Midtown Ferry',
    destPos: [40.7590, -74.0002],
    color: '#059669',
    root: {
      type: 'source',
      label: 'NJ Waterway',
      pos: [40.762, -74.013],
      weight: 30,
    },
  },
]

const DEFAULTS = { lat: 40.740, lng: -74.020, zoom: 12.5 }
const REF_LAT = 40.740

export default function MultiTreeMerge() {
  const [llz, setLLZ] = useLLZ(DEFAULTS)

  const geojson = useMemo(() => {
    const allFeatures: GeoJSON.Feature[] = []
    for (const tree of trees) {
      const opts: RenderFlowTreeOpts = {
        refLat: REF_LAT,
        zoom: llz.zoom,
        geoScale: 1,
        color: tree.color,
        key: tree.dest,
        pxPerWeight: (w: number) => w * 0.1,
        arrowWing: 1.8,
        arrowLen: 1.2,
      }
      const fc = renderFlows([tree], opts)
      allFeatures.push(...fc.features)
    }
    allFeatures.sort((a, b) => ((b.properties?.width as number) ?? 0) - ((a.properties?.width as number) ?? 0))
    return { type: 'FeatureCollection' as const, features: allFeatures }
  }, [llz.zoom])

  const onMove = useCallback((e: { viewState: { longitude: number; latitude: number; zoom: number } }) => {
    setLLZ({ lat: e.viewState.latitude, lng: e.viewState.longitude, zoom: e.viewState.zoom })
  }, [setLLZ])

  return (
    <div className="example">
      <h2>Multi-Tree Merge</h2>
      <p>Multiple flow trees with different colors converging on destinations across the Hudson River. Inspired by NJ→Manhattan commuter flows.</p>
      <div className="legend">
        {trees.map(t => (
          <span key={t.dest} className="legend-item">
            <span className="legend-swatch" style={{ background: t.color }} />
            {t.dest}
          </span>
        ))}
      </div>
      <div className="map-container">
        <Map
          initialViewState={{ longitude: llz.lng, latitude: llz.lat, zoom: llz.zoom }}
          style={{ width: '100%', height: '100%' }}
          mapStyle="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
          onMove={onMove}
        >
          <Source id="flows" type="geojson" data={geojson}>
            <Layer
              id="flows-fill"
              type="fill"
              paint={{
                'fill-color': ['get', 'color'],
                'fill-opacity': 0.85,
              }}
            />
            <Layer
              id="flows-outline"
              type="line"
              paint={{
                'line-color': ['get', 'color'],
                'line-width': 0.5,
                'line-opacity': 0.9,
              }}
            />
          </Source>
        </Map>
      </div>
    </div>
  )
}
