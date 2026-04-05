import { useMemo, useCallback, useState } from 'react'
import MapGL, { Source, Layer } from 'react-map-gl/maplibre'
import { useUrlState } from 'use-prms'
import type { Param } from 'use-prms'
import { useActions } from 'use-kbd'
import { renderFlowGraph, renderFlowGraphSinglePoly, renderFlowGraphDebug } from 'geo-sankey'
import type { FlowGraph, FlowGraphOpts } from 'geo-sankey'
import { useLLZ } from './llz'
import { useTheme, MAP_STYLES } from './App'
import 'maplibre-gl/dist/maplibre-gl.css'

const { atan2, PI } = Math

const boolParam: Param<boolean> = {
  encode: (v) => v ? '1' : undefined,
  decode: (s) => s === '1' || s === '',
}
const numParam = (def: number): Param<number> => ({
  encode: (v) => v === def ? undefined : String(v),
  decode: (s) => { const n = parseFloat(s ?? ''); return isNaN(n) ? def : n },
})
const intParam = (def: number): Param<number> => ({
  encode: (v) => v === def ? undefined : String(v),
  decode: (s) => { const n = parseInt(s ?? '', 10); return isNaN(n) ? def : n },
})

export interface FlowMapViewProps {
  graph: FlowGraph
  title: string
  description: string
  color: string
  pxPerWeight: number
  refLat: number
  defaults: { lat: number; lng: number; zoom: number }
}

export default function FlowMapView({ graph, title, description, color, pxPerWeight, refLat, defaults }: FlowMapViewProps) {
  const [llz, setLLZ] = useLLZ(defaults)
  const [singlePoly, setSinglePoly] = useUrlState('sp', boolParam)
  const [showRing, setShowRing] = useUrlState('ring', boolParam)
  const [showNodes, setShowNodes] = useUrlState('nodes', boolParam)
  const [showGraph, setShowGraph] = useUrlState('graph', boolParam)
  const [opacity, setOpacity] = useUrlState('o', numParam(0.5))
  const [wing, setWing] = useUrlState('w', numParam(0.3))
  const [angle, setAngle] = useUrlState('ang', intParam(45))
  const [bezierN, setBezierN] = useUrlState('bn', intParam(20))
  const [nodeApproach, setNodeApproach] = useUrlState('na', numParam(0.5))
  const [creaseSkip, setCreaseSkip] = useUrlState('cs', intParam(1))

  useActions({
    toggleSinglePoly: { label: 'Toggle single-poly', group: 'Config', defaultBindings: ['s'], handler: () => setSinglePoly(!singlePoly) },
    toggleRingPoints: { label: 'Toggle ring points', group: 'Config', defaultBindings: ['r'], handler: () => setShowRing(!showRing) },
    toggleNodes: { label: 'Toggle nodes', group: 'Config', defaultBindings: ['n'], handler: () => setShowNodes(!showNodes) },
    toggleGraph: { label: 'Toggle graph overlay', group: 'Config', defaultBindings: ['g'], handler: () => setShowGraph(!showGraph) },
    opacityUp: { label: 'Increase opacity', group: 'Config', defaultBindings: ['shift+up'], handler: () => setOpacity(Math.min(1, opacity + 0.1)) },
    opacityDown: { label: 'Decrease opacity', group: 'Config', defaultBindings: ['shift+down'], handler: () => setOpacity(Math.max(0.1, opacity - 0.1)) },
    bplUp: { label: 'Increase BPL', group: 'Config', defaultBindings: ['b'], handler: () => setBezierN(Math.min(40, bezierN + 2)) },
    bplDown: { label: 'Decrease BPL', group: 'Config', defaultBindings: ['shift+b'], handler: () => setBezierN(Math.max(1, bezierN - 2)) },
    creaseUp: { label: 'Increase crease skip', group: 'Config', defaultBindings: ['c'], handler: () => setCreaseSkip(Math.min(4, creaseSkip + 1)) },
    creaseDown: { label: 'Decrease crease skip', group: 'Config', defaultBindings: ['shift+c'], handler: () => setCreaseSkip(Math.max(0, creaseSkip - 1)) },
    approachUp: { label: 'Increase approach', group: 'Config', defaultBindings: ['a'], handler: () => setNodeApproach(Math.min(3, nodeApproach + 0.1)) },
    approachDown: { label: 'Decrease approach', group: 'Config', defaultBindings: ['shift+a'], handler: () => setNodeApproach(Math.max(0, nodeApproach - 0.1)) },
  })

  const graphOpts: FlowGraphOpts = {
    refLat, zoom: llz.zoom, color, pxPerWeight,
    wing, angle, bezierN, nodeApproach, creaseSkip,
  }

  const geojson = useMemo(() =>
    singlePoly
      ? renderFlowGraphSinglePoly(graph, graphOpts)
      : renderFlowGraph(graph, graphOpts),
  [llz.zoom, singlePoly, wing, angle, bezierN, nodeApproach, creaseSkip])

  const nodePoints = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: graph.nodes.map(n => ({
      type: 'Feature' as const,
      properties: { id: n.id, label: n.label ?? n.id, bearing: n.bearing },
      geometry: { type: 'Point' as const, coordinates: [n.pos[1], n.pos[0]] },
    })),
  }), [])

  const debugGeo = useMemo(() =>
    showGraph ? renderFlowGraphDebug(graph, graphOpts) : null,
  [showGraph, llz.zoom, wing, angle, bezierN, nodeApproach])

  const ringPoints = useMemo(() => {
    if (!showRing || !geojson.features.length) return null
    const pts: GeoJSON.Feature[] = []
    for (const f of geojson.features) {
      const coords = (f.geometry as GeoJSON.Polygon).coordinates[0]
      for (let i = 0; i < coords.length - 1; i++) {
        pts.push({ type: 'Feature', properties: { idx: i }, geometry: { type: 'Point', coordinates: coords[i] } })
      }
    }
    return { type: 'FeatureCollection' as const, features: pts }
  }, [geojson, showRing])

  const ringEdges = useMemo(() => {
    if (!showRing || !geojson.features.length) return null
    const segs: GeoJSON.Feature[] = []
    for (const f of geojson.features) {
      const coords = (f.geometry as GeoJSON.Polygon).coordinates[0]
      for (let i = 0; i < coords.length - 1; i++) {
        const [lon0, lat0] = coords[i], [lon1, lat1] = coords[i + 1]
        const bearing = atan2(lon1 - lon0, lat1 - lat0) * 180 / PI
        segs.push({
          type: 'Feature',
          properties: {
            idx: i, label: `${i}`,
            bearing: Math.round(bearing * 10) / 10,
            from: `${lat0.toFixed(6)},${lon0.toFixed(6)}`,
            to: `${lat1.toFixed(6)},${lon1.toFixed(6)}`,
          },
          geometry: { type: 'LineString', coordinates: [coords[i], coords[i + 1]] },
        })
      }
    }
    return { type: 'FeatureCollection' as const, features: segs }
  }, [geojson, showRing])

  const onMove = useCallback((e: { viewState: { longitude: number; latitude: number; zoom: number } }) => {
    setLLZ({ lat: e.viewState.latitude, lng: e.viewState.longitude, zoom: e.viewState.zoom })
  }, [setLLZ])

  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)
  const onHover = useCallback((e: any) => {
    if (e.features?.length) {
      const f = e.features[0], p = f.properties
      if (f.geometry?.type === 'Point') {
        const [lon, lat] = f.geometry.coordinates
        setTooltip({ x: e.point.x, y: e.point.y, text: `pt #${p.idx}\n${lat.toFixed(6)}, ${lon.toFixed(6)}` })
      } else {
        setTooltip({ x: e.point.x, y: e.point.y, text: `edge #${p.idx} bearing:${p.bearing}\u00B0\n${p.from} → ${p.to}` })
      }
    } else {
      setTooltip(null)
    }
  }, [])

  const { theme } = useTheme()

  const slider = (label: string, value: number, set: (v: number) => void, min: number, max: number, step: number, fmt?: (v: number) => string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <label style={{ fontSize: 12 }}>{label}:</label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => set(parseFloat(e.target.value))} style={{ width: 80 }} />
      <span style={{ fontSize: 11, minWidth: 24 }}>{fmt ? fmt(value) : value}</span>
    </div>
  )

  return (
    <div className="example">
      <h2>{title}</h2>
      <p>{description}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '4px 0 8px', alignItems: 'center' }}>
        {[
          ['Single-poly', singlePoly, setSinglePoly],
          ['Ring points', showRing, setShowRing],
          ['Nodes', showNodes, setShowNodes],
          ['Graph', showGraph, setShowGraph],
        ].map(([label, val, set]) => (
          <label key={label as string} style={{ fontSize: 12 }}>
            <input type="checkbox" checked={val as boolean} onChange={e => (set as (v: boolean) => void)(e.target.checked)} />
            {' '}{label as string}
          </label>
        ))}
        {slider('Opacity', opacity, setOpacity, 0.1, 1, 0.05, v => v.toFixed(2))}
        {slider('Wing', wing, setWing, 0, 1, 0.05, v => v.toFixed(2))}
        {slider('Angle', angle, setAngle, 1, 60, 1)}
        {slider('BPL', bezierN, setBezierN, 1, 40, 1)}
        {slider('Approach', nodeApproach, setNodeApproach, 0, 3, 0.1, v => v.toFixed(1))}
        {slider('Crease', creaseSkip, setCreaseSkip, 0, 4, 1)}
      </div>
      <div className="map-container" style={{ position: 'relative' }}>
        <MapGL
          initialViewState={{ longitude: llz.lng, latitude: llz.lat, zoom: llz.zoom }}
          style={{ width: '100%', height: '100%' }}
          mapStyle={MAP_STYLES[theme]}
          onMove={onMove}
          onMouseMove={onHover}
          onMouseLeave={() => setTooltip(null)}
          interactiveLayerIds={showRing ? ['ring-edge-lines', 'ring-edge-labels', 'ring-circles'] : []}
        >
          <Source id="flows" type="geojson" data={geojson}>
            <Layer id="flows-fill" type="fill" paint={{ 'fill-color': ['get', 'color'], 'fill-opacity': opacity }} />
          </Source>
          {showNodes && (
            <Source id="nodes" type="geojson" data={nodePoints}>
              <Layer id="node-circles" type="circle" paint={{ 'circle-radius': 5, 'circle-color': '#e11d48', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 }} />
              <Layer id="node-labels" type="symbol"
                layout={{ 'text-field': ['get', 'label'], 'text-size': 11, 'text-offset': [0, 1.4], 'text-anchor': 'top', 'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'] }}
                paint={{ 'text-color': '#e11d48', 'text-halo-color': '#fff', 'text-halo-width': 1.5 }} />
            </Source>
          )}
          {showRing && ringEdges && (
            <Source id="ring-edges" type="geojson" data={ringEdges}>
              <Layer id="ring-edge-lines" type="line" paint={{ 'line-color': '#facc15', 'line-width': 1.5 }} />
              <Layer id="ring-edge-labels" type="symbol"
                layout={{ 'text-field': ['get', 'label'], 'text-size': 14, 'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'], 'text-allow-overlap': true, 'symbol-placement': 'line-center' }}
                paint={{ 'text-color': '#facc15', 'text-halo-color': '#000', 'text-halo-width': 1.5 }} />
            </Source>
          )}
          {showRing && ringPoints && (
            <Source id="ring-pts" type="geojson" data={ringPoints}>
              <Layer id="ring-circles" type="circle" paint={{ 'circle-radius': 4, 'circle-color': '#f59e0b', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 }} />
              <Layer id="ring-pt-labels" type="symbol"
                layout={{ 'text-field': ['get', 'idx'], 'text-size': 13, 'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'], 'text-offset': [0, -1.2], 'text-anchor': 'bottom', 'text-allow-overlap': true }}
                paint={{ 'text-color': '#f59e0b', 'text-halo-color': '#000', 'text-halo-width': 1 }} />
            </Source>
          )}
          {showGraph && debugGeo && (
            <Source id="debug-geo" type="geojson" data={debugGeo}>
              <Layer id="debug-beziers" type="line" filter={['==', ['get', 'kind'], 'bezier']} paint={{ 'line-color': '#ef4444', 'line-width': 2, 'line-dasharray': [4, 2] }} />
              <Layer id="debug-approach" type="fill" filter={['in', ['get', 'kind'], ['literal', ['approach', 'arrowhead']]]} paint={{ 'fill-color': '#ef4444', 'fill-opacity': 0.15 }} />
              <Layer id="debug-approach-outline" type="line" filter={['in', ['get', 'kind'], ['literal', ['approach', 'arrowhead']]]} paint={{ 'line-color': '#ef4444', 'line-width': 1, 'line-dasharray': [2, 2] }} />
              <Layer id="debug-bezier-pts" type="circle" filter={['==', ['get', 'kind'], 'bezier-pt']} paint={{ 'circle-radius': 3, 'circle-color': '#ef4444', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 }} />
              <Layer id="debug-weight-labels" type="symbol" filter={['==', ['get', 'kind'], 'bezier']}
                layout={{ 'text-field': ['get', 'weight'], 'text-size': 16, 'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'], 'text-allow-overlap': true, 'symbol-placement': 'line-center' }}
                paint={{ 'text-color': '#ef4444', 'text-halo-color': '#fff', 'text-halo-width': 2 }} />
            </Source>
          )}
        </MapGL>
        {tooltip && (
          <div style={{ position: 'absolute', left: tooltip.x + 10, top: tooltip.y - 10, background: 'rgba(0,0,0,0.85)', color: '#fff', padding: '4px 8px', borderRadius: 4, fontSize: 11, whiteSpace: 'pre', pointerEvents: 'none', zIndex: 10 }}>{tooltip.text}</div>
        )}
      </div>
    </div>
  )
}
