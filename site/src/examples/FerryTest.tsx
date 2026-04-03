import { useMemo, useCallback } from 'react'
import MapGL, { Source, Layer } from 'react-map-gl/maplibre'
import { useUrlState } from 'use-prms'
import type { Param } from 'use-prms'
import { renderFlowGraph, renderFlowGraphSinglePoly } from 'geo-sankey'
import type { FlowGraph, FlowGraphOpts } from 'geo-sankey'
import { useLLZ } from '../llz'
import { useTheme, MAP_STYLES } from '../App'
import 'maplibre-gl/dist/maplibre-gl.css'

// Simple flow graph: origin splits, north merges, dest and south are sinks
const graph: FlowGraph = {
  nodes: [
    { id: 'origin',  pos: [40.735, -74.055], bearing: 90, label: 'Origin' },
    { id: 'split',   pos: [40.735, -74.045], bearing: 90 },
    { id: 'merge',   pos: [40.735, -74.020], bearing: 90 },
    { id: 'dest',    pos: [40.735, -74.000], bearing: 90, label: 'Destination' },
    { id: 'north',   pos: [40.748, -74.038], bearing: 150, label: 'North' },
    { id: 'south',   pos: [40.720, -74.038], bearing: 30, label: 'South' },
  ],
  edges: [
    { from: 'origin', to: 'split', weight: 35 },
    { from: 'split', to: 'merge', weight: 20 },
    { from: 'split', to: 'south', weight: 15 },
    { from: 'north', to: 'merge', weight: 30 },
    { from: 'merge', to: 'dest', weight: 50 },
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

const DEFAULTS = { lat: 40.735, lng: -74.030, zoom: 13 }

export default function FerryTest() {
  const [llz, setLLZ] = useLLZ(DEFAULTS)
  const [singlePoly, setSinglePoly] = useUrlState('sp', boolParam)
  const [showRing, setShowRing] = useUrlState('ring', boolParam)
  const [showNodes, setShowNodes] = useUrlState('nodes', boolParam)
  const [arrowWing, setArrowWing] = useUrlState('aw', numParam(1.6))
  const [arrowLen, setArrowLen] = useUrlState('al', numParam(1.3))
  const [opacity, setOpacity] = useUrlState('o', numParam(0.5))
  const [showGraph, setShowGraph] = useUrlState('graph', boolParam)
  const [bezierN, setBezierN] = useUrlState('bn', numParam(20))
  const [nodeApproach, setNodeApproach] = useUrlState('na', numParam(0.5))

  const graphOpts: FlowGraphOpts = {
    refLat: 40.735,
    zoom: llz.zoom,
    color: '#2563eb',
    pxPerWeight: 0.3,
    arrowWing,
    arrowLen,
    bezierN: Math.round(bezierN),
    nodeApproach,
  }

  const geojson = useMemo(() =>
    singlePoly
      ? renderFlowGraphSinglePoly(graph, graphOpts)
      : renderFlowGraph(graph, graphOpts),
  [llz.zoom, singlePoly, arrowWing, arrowLen, bezierN, nodeApproach])

  const nodePoints = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: graph.nodes.map(n => ({
      type: 'Feature' as const,
      properties: { id: n.id, label: n.label ?? n.id, bearing: n.bearing },
      geometry: { type: 'Point' as const, coordinates: [n.pos[1], n.pos[0]] },
    })),
  }), [])

  // Raw directed graph: edges as lines, nodes as points with labels
  const graphEdges = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: graph.edges.map(e => {
      const src = graph.nodes.find(n => n.id === e.from)!
      const dst = graph.nodes.find(n => n.id === e.to)!
      const midLon = (src.pos[1] + dst.pos[1]) / 2
      const midLat = (src.pos[0] + dst.pos[0]) / 2
      return {
        type: 'Feature' as const,
        properties: { weight: e.weight, label: `${e.weight}` },
        geometry: {
          type: 'LineString' as const,
          coordinates: [[src.pos[1], src.pos[0]], [dst.pos[1], dst.pos[0]]],
        },
      }
    }),
  }), [])

  const graphEdgeMidpoints = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: graph.edges.map(e => {
      const src = graph.nodes.find(n => n.id === e.from)!
      const dst = graph.nodes.find(n => n.id === e.to)!
      return {
        type: 'Feature' as const,
        properties: { label: `${e.weight}` },
        geometry: {
          type: 'Point' as const,
          coordinates: [(src.pos[1] + dst.pos[1]) / 2, (src.pos[0] + dst.pos[0]) / 2],
        },
      }
    }),
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
      <h2>Flow Graph Test</h2>
      <p>Graph-based flow rendering: origin splits, north merges, two sinks with arrowheads.</p>
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
        <label style={{ fontSize: 12 }}>
          <input type="checkbox" checked={showGraph} onChange={e => setShowGraph(e.target.checked)} />
          {' '}Graph
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <label style={{ fontSize: 12 }}>Opacity:</label>
          <input type="range" min="0.1" max="1" step="0.05" value={opacity}
            onChange={e => setOpacity(parseFloat(e.target.value))} style={{ width: 80 }} />
          <span style={{ fontSize: 11, minWidth: 24 }}>{opacity.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <label style={{ fontSize: 12 }}>Wing:</label>
          <input type="range" min="1" max="5" step="0.1" value={arrowWing}
            onChange={e => setArrowWing(parseFloat(e.target.value))} style={{ width: 80 }} />
          <span style={{ fontSize: 11, minWidth: 24 }}>{arrowWing.toFixed(1)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <label style={{ fontSize: 12 }}>ArrowLen:</label>
          <input type="range" min="0.5" max="4" step="0.1" value={arrowLen}
            onChange={e => setArrowLen(parseFloat(e.target.value))} style={{ width: 80 }} />
          <span style={{ fontSize: 11, minWidth: 24 }}>{arrowLen.toFixed(1)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <label style={{ fontSize: 12 }}>BPL:</label>
          <input type="range" min="1" max="40" step="1" value={bezierN}
            onChange={e => setBezierN(parseFloat(e.target.value))} style={{ width: 80 }} />
          <span style={{ fontSize: 11, minWidth: 24 }}>{Math.round(bezierN)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <label style={{ fontSize: 12 }}>Approach:</label>
          <input type="range" min="0" max="3" step="0.1" value={nodeApproach}
            onChange={e => setNodeApproach(parseFloat(e.target.value))} style={{ width: 80 }} />
          <span style={{ fontSize: 11, minWidth: 24 }}>{nodeApproach.toFixed(1)}</span>
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
              paint={{ 'fill-color': ['get', 'color'], 'fill-opacity': opacity }}
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
          {showGraph && (
            <Source id="graph-edges" type="geojson" data={graphEdges}>
              <Layer
                id="graph-edge-lines"
                type="line"
                paint={{ 'line-color': '#ef4444', 'line-width': ['get', 'weight'], 'line-opacity': 0.5 }}
              />
            </Source>
          )}
          {showGraph && (
            <Source id="graph-edge-labels" type="geojson" data={graphEdgeMidpoints}>
              <Layer
                id="graph-weight-labels"
                type="symbol"
                layout={{
                  'text-field': ['get', 'label'],
                  'text-size': 16,
                  'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'],
                  'text-allow-overlap': true,
                }}
                paint={{ 'text-color': '#ef4444', 'text-halo-color': '#fff', 'text-halo-width': 2 }}
              />
            </Source>
          )}
        </MapGL>
      </div>
    </div>
  )
}
