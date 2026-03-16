import { useMemo, useCallback } from 'react'
import MapGL, { Source, Layer } from 'react-map-gl/maplibre'
import { useUrlState } from 'use-prms'
import type { Param } from 'use-prms'
import { renderFlowGraph, renderFlowGraphSinglePoly } from 'geo-sankey'
import type { FlowGraph, FlowGraphOpts } from 'geo-sankey'
import { useLLZ } from '../llz'
import { useTheme, MAP_STYLES } from '../App'
import 'maplibre-gl/dist/maplibre-gl.css'

// Full HBT ferry layout
const graph: FlowGraph = {
  nodes: [
    { id: 'hob-so',    pos: [40.7359, -74.0275], bearing: 90, label: 'Hob So' },
    { id: 'hob-14',    pos: [40.7505, -74.0241], bearing: 90, label: 'Hob 14th' },
    { id: 'whk',       pos: [40.7771, -74.0136], bearing: 130, label: 'Weehawken' },
    { id: 'ph',        pos: [40.7138, -74.0337], bearing: 60, label: 'Port Hamilton' },
    { id: 'hob-split', pos: [40.7359, -74.0230], bearing: 90 },
    { id: 'ut-merge',  pos: [40.7530, -74.0160], bearing: 30 },
    { id: 'dt-merge',  pos: [40.7142, -74.0210], bearing: 90 },
    { id: 'mt-merge',  pos: [40.7565, -74.0120], bearing: 110 },
    { id: 'mt39',      pos: [40.7555, -74.0060], bearing: 110, label: 'MT 39th St' },
    { id: 'bpt',       pos: [40.7142, -74.0169], bearing: 90, label: 'Brookfield' },
  ],
  edges: [
    { from: 'hob-so', to: 'hob-split', weight: 30 },
    { from: 'hob-split', to: 'ut-merge', weight: 15 },
    { from: 'hob-split', to: 'dt-merge', weight: 15 },
    { from: 'hob-14', to: 'ut-merge', weight: 20 },
    { from: 'ut-merge', to: 'mt-merge', weight: 35 },
    { from: 'whk', to: 'mt-merge', weight: 30 },
    { from: 'mt-merge', to: 'mt39', weight: 65 },
    { from: 'ph', to: 'dt-merge', weight: 20 },
    { from: 'dt-merge', to: 'bpt', weight: 35 },
  ],
}

const boolParam: Param<boolean> = {
  encode: (v) => v ? '1' : undefined,
  decode: (s) => s === '1',
}
const numParam = (def: number): Param<number> => ({
  encode: (v) => v === def ? undefined : v.toFixed(2),
  decode: (s) => s ? parseFloat(s) || def : def,
})

const DEFAULTS = { lat: 40.740, lng: -74.020, zoom: 13 }

export default function FerryTest() {
  const [llz, setLLZ] = useLLZ(DEFAULTS)
  const [singlePoly, setSinglePoly] = useUrlState('sp', boolParam)
  const [showRing, setShowRing] = useUrlState('ring', boolParam)
  const [showNodes, setShowNodes] = useUrlState('nodes', boolParam)
  const [arrowWing, setArrowWing] = useUrlState('aw', numParam(2.5))
  const [arrowLen, setArrowLen] = useUrlState('al', numParam(2.0))

  const graphOpts: FlowGraphOpts = {
    refLat: 40.740,
    zoom: llz.zoom,
    color: '#14B8A6',
    pxPerWeight: 0.15,
    arrowWing,
    arrowLen,
  }

  const geojson = useMemo(() =>
    singlePoly
      ? renderFlowGraphSinglePoly(graph, graphOpts)
      : renderFlowGraph(graph, graphOpts),
  [llz.zoom, singlePoly, arrowWing, arrowLen])

  const nodePoints = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: graph.nodes.map(n => ({
      type: 'Feature' as const,
      properties: { id: n.id, label: n.label ?? n.id, bearing: n.bearing },
      geometry: { type: 'Point' as const, coordinates: [n.pos[1], n.pos[0]] },
    })),
  }), [])

  const ringPoints = useMemo(() => {
    if (!showRing || !geojson.features.length) return null
    const pts: GeoJSON.Feature[] = []
    for (const f of geojson.features) {
      const coords = (f.geometry as GeoJSON.Polygon).coordinates[0]
      for (let i = 0; i < coords.length - 1; i++) {
        pts.push({
          type: 'Feature',
          properties: { idx: i },
          geometry: { type: 'Point', coordinates: coords[i] },
        })
      }
    }
    return { type: 'FeatureCollection' as const, features: pts }
  }, [geojson, showRing])

  const onMove = useCallback((e: { viewState: { longitude: number; latitude: number; zoom: number } }) => {
    setLLZ({ lat: e.viewState.latitude, lng: e.viewState.longitude, zoom: e.viewState.zoom })
  }, [setLLZ])

  const { theme } = useTheme()

  return (
    <div className="example">
      <h2>HBT Ferry Flows</h2>
      <p>Full Hudson ferry network: Hob So splits to uptown (MT39) and downtown (Brookfield).</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '4px 0 8px', alignItems: 'center' }}>
        <label style={{ fontSize: 12 }}>
          <input type="checkbox" checked={singlePoly} onChange={e => setSinglePoly(e.target.checked)} />
          {' '}Single-poly
        </label>
        <label style={{ fontSize: 12 }}>
          <input type="checkbox" checked={showRing} onChange={e => setShowRing(e.target.checked)} />
          {' '}Ring points
        </label>
        <label style={{ fontSize: 12 }}>
          <input type="checkbox" checked={showNodes} onChange={e => setShowNodes(e.target.checked)} />
          {' '}Nodes
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <label style={{ fontSize: 12 }}>Wing:</label>
          <input type="range" min="1" max="5" step="0.1" value={arrowWing}
            onChange={e => setArrowWing(parseFloat(e.target.value))} style={{ width: 80 }} />
          <span style={{ fontSize: 11, minWidth: 24 }}>{arrowWing.toFixed(1)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <label style={{ fontSize: 12 }}>Length:</label>
          <input type="range" min="0.5" max="4" step="0.1" value={arrowLen}
            onChange={e => setArrowLen(parseFloat(e.target.value))} style={{ width: 80 }} />
          <span style={{ fontSize: 11, minWidth: 24 }}>{arrowLen.toFixed(1)}</span>
        </div>
      </div>
      <div className="map-container">
        <MapGL
          initialViewState={{ longitude: llz.lng, latitude: llz.lat, zoom: llz.zoom }}
          style={{ width: '100%', height: '100%' }}
          mapStyle={MAP_STYLES[theme]}
          onMove={onMove}
        >
          <Source id="flows" type="geojson" data={geojson}>
            <Layer
              id="flows-fill"
              type="fill"
              paint={{ 'fill-color': ['get', 'color'], 'fill-opacity': 0.5 }}
            />
          </Source>
          {showNodes && (
            <Source id="nodes" type="geojson" data={nodePoints}>
              <Layer
                id="node-circles"
                type="circle"
                paint={{ 'circle-radius': 5, 'circle-color': '#e11d48', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 }}
              />
              <Layer
                id="node-labels"
                type="symbol"
                layout={{
                  'text-field': ['get', 'label'],
                  'text-size': 11,
                  'text-offset': [0, 1.4],
                  'text-anchor': 'top',
                  'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'],
                }}
                paint={{ 'text-color': '#e11d48', 'text-halo-color': '#fff', 'text-halo-width': 1.5 }}
              />
            </Source>
          )}
          {showRing && ringPoints && (
            <Source id="ring-pts" type="geojson" data={ringPoints}>
              <Layer
                id="ring-circles"
                type="circle"
                paint={{ 'circle-radius': 4, 'circle-color': '#f59e0b', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 }}
              />
            </Source>
          )}
        </MapGL>
      </div>
    </div>
  )
}
