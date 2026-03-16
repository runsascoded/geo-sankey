import { useMemo, useCallback, useState } from 'react'
import MapGL, { Source, Layer } from 'react-map-gl/maplibre'
import { renderFlowGraph, renderFlowGraphSinglePoly } from 'geo-sankey'
import type { FlowGraph } from 'geo-sankey'
import { useLLZ } from '../llz'
import 'maplibre-gl/dist/maplibre-gl.css'

const graph: FlowGraph = {
  nodes: [
    { id: 'origin',  pos: [40.735, -74.045], bearing: 90, label: 'Origin' },
    { id: 'split',   pos: [40.735, -74.040], bearing: 90 },
    { id: 'merge',   pos: [40.735, -74.020], bearing: 90 },
    { id: 'dest',    pos: [40.735, -74.005], bearing: 90, label: 'Destination' },
    { id: 'north',   pos: [40.745, -74.035], bearing: 150, label: 'North' },
    { id: 'south',   pos: [40.725, -74.030], bearing: 30, label: 'South' },
  ],
  edges: [
    { from: 'origin', to: 'split', weight: 35 },
    { from: 'split', to: 'merge', weight: 20 },
    { from: 'split', to: 'south', weight: 15 },
    { from: 'north', to: 'merge', weight: 30 },
    { from: 'merge', to: 'dest', weight: 50 },
  ],
}

const DEFAULTS = { lat: 40.735, lng: -74.025, zoom: 14 }

export default function FerryTest() {
  const [llz, setLLZ] = useLLZ(DEFAULTS)
  const [singlePoly, setSinglePoly] = useState(false)

  const graphOpts = {
    refLat: 40.735,
    zoom: llz.zoom,
    color: '#2563eb',
    pxPerWeight: 0.3,
  }
  const geojson = useMemo(() =>
    singlePoly
      ? renderFlowGraphSinglePoly(graph, graphOpts)
      : renderFlowGraph(graph, graphOpts),
  [llz.zoom, singlePoly])

  const onMove = useCallback((e: { viewState: { longitude: number; latitude: number; zoom: number } }) => {
    setLLZ({ lat: e.viewState.latitude, lng: e.viewState.longitude, zoom: e.viewState.zoom })
  }, [setLLZ])

  return (
    <div className="example">
      <h2>Flow Graph Test</h2>
      <p>Graph-based flow rendering: edges as bezier ribbons, nodes as merge/split junctions.</p>
      <label style={{ fontSize: 12 }}>
        <input type="checkbox" checked={singlePoly} onChange={e => setSinglePoly(e.target.checked)} />
        {' '}Single-poly mode
      </label>
      <div className="map-container">
        <MapGL
          initialViewState={{ longitude: llz.lng, latitude: llz.lat, zoom: llz.zoom }}
          style={{ width: '100%', height: '100%' }}
          mapStyle="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
          onMove={onMove}
        >
          <Source id="flows" type="geojson" data={geojson}>
            <Layer
              id="flows-fill"
              type="fill"
              paint={{ 'fill-color': ['get', 'color'], 'fill-opacity': 0.5 }}
            />
          </Source>
        </MapGL>
      </div>
    </div>
  )
}
