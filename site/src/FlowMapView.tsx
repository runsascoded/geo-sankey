import { useMemo, useCallback, useState, useRef, useEffect, useReducer } from 'react'
import MapGL, { Source, Layer } from 'react-map-gl/maplibre'
import { useUrlState } from 'use-prms'
import type { Param } from 'use-prms'
import { useActions } from 'use-kbd'
import { renderFlowGraph, renderFlowGraphSinglePoly, renderFlowGraphDebug, renderNodes } from 'geo-sankey'
import type { FlowGraph, FlowGraphOpts } from 'geo-sankey'
import BearingDial from './BearingDial'
import Drawer, { Row, Slider, Check } from './Drawer'
import NodeOverlay from './NodeOverlay'
import { useLLZ } from './llz'
import { useTheme, MAP_STYLES } from './App'
import 'maplibre-gl/dist/maplibre-gl.css'

const { atan2, PI, round } = Math

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
  defaultNodes?: number
}

type Selection = { type: 'node'; id: string } | { type: 'edge'; from: string; to: string } | null

type GraphAction =
  | { type: 'set'; next: FlowGraph | ((g: FlowGraph) => FlowGraph); history: boolean }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'pushHistory'; snapshot: FlowGraph }

interface GraphState { graph: FlowGraph; past: FlowGraph[]; future: FlowGraph[] }

function graphReducer(s: GraphState, a: GraphAction): GraphState {
  switch (a.type) {
    case 'set': {
      const next = typeof a.next === 'function' ? a.next(s.graph) : a.next
      if (!a.history) return { ...s, graph: next }
      if (next === s.graph) return s
      return { graph: next, past: [...s.past, s.graph], future: [] }
    }
    case 'pushHistory': {
      // Dedup only against the LAST past entry (avoid duplicate consecutive snapshots).
      // Explicit pushHistory is for begin-of-drag — it should push even when snapshot equals current,
      // because transient updates to follow will mutate current without pushing history themselves.
      const last = s.past[s.past.length - 1]
      if (last === a.snapshot) return s
      return { ...s, past: [...s.past, a.snapshot], future: [] }
    }
    case 'undo': {
      if (s.past.length === 0) return s
      const prev = s.past[s.past.length - 1]
      return { graph: prev, past: s.past.slice(0, -1), future: [...s.future, s.graph] }
    }
    case 'redo': {
      if (s.future.length === 0) return s
      const next = s.future[s.future.length - 1]
      return { graph: next, past: [...s.past, s.graph], future: s.future.slice(0, -1) }
    }
  }
}

export default function FlowMapView({ graph: initialGraph, title, description, color, pxPerWeight, refLat, defaults, defaultNodes = 0 }: FlowMapViewProps) {
  const [gs, dispatch] = useReducer(graphReducer, { graph: initialGraph, past: [], future: [] })
  const graph = gs.graph
  const setGraph = useCallback((next: FlowGraph | ((g: FlowGraph) => FlowGraph)) => {
    dispatch({ type: 'set', next, history: false })
  }, [])
  const [llz, setLLZ] = useLLZ(defaults)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [editMode, setEditMode] = useState(() => sessionStorage.getItem('geo-sankey-edit') === '1')
  const [selection, setSelectionRaw] = useState<Selection>(() => {
    try { const s = sessionStorage.getItem('geo-sankey-sel'); return s ? JSON.parse(s) : null } catch { return null }
  })
  const setSelection = useCallback((s: Selection) => {
    setSelectionRaw(s)
    sessionStorage.setItem('geo-sankey-sel', s ? JSON.stringify(s) : '')
  }, [])
  const [dragging, setDragging] = useState<string | null>(null)
  const [edgeSource, setEdgeSource] = useState<string | null>(null) // for edge creation

  const pushGraph = useCallback((next: FlowGraph | ((g: FlowGraph) => FlowGraph)) => {
    dispatch({ type: 'set', next, history: true })
  }, [])
  const pushHistory = useCallback((snapshot: FlowGraph) => {
    dispatch({ type: 'pushHistory', snapshot })
  }, [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])

  // Graph mutation helpers
  const updateNode = useCallback((id: string, patch: Partial<{ pos: [number, number]; bearing: number; label: string }>) => {
    pushGraph(g => ({
      ...g,
      nodes: g.nodes.map(n => n.id === id ? { ...n, ...patch } : n),
    }))
  }, [pushGraph])
  const addNode = useCallback((pos: [number, number]) => {
    const id = `n${Date.now()}`
    pushGraph(g => ({ ...g, nodes: [...g.nodes, { id, pos }] }))
    setSelection({ type: 'node', id })
  }, [pushGraph])
  const deleteNode = useCallback((id: string) => {
    pushGraph(g => ({
      nodes: g.nodes.filter(n => n.id !== id),
      edges: g.edges.filter(e => e.from !== id && e.to !== id),
    }))
    setSelection(null)
  }, [pushGraph])
  const addEdge = useCallback((from: string, to: string) => {
    if (from === to) return
    pushGraph(g => ({ ...g, edges: [...g.edges, { from, to, weight: 10 }] }))
    setSelection({ type: 'edge', from, to })
  }, [pushGraph])
  const updateEdge = useCallback((from: string, to: string, patch: Partial<{ weight: number }>) => {
    pushGraph(g => ({
      ...g,
      edges: g.edges.map(e => e.from === from && e.to === to ? { ...e, ...patch } : e),
    }))
  }, [pushGraph])
  const deleteEdge = useCallback((from: string, to: string) => {
    pushGraph(g => ({ ...g, edges: g.edges.filter(e => !(e.from === from && e.to === to)) }))
    setSelection(null)
  }, [pushGraph])
  const [singlePoly, setSinglePoly] = useUrlState('sp', { encode: (v) => v ? undefined : '0', decode: (s) => s !== '0' })
  const [showRing, setShowRing] = useUrlState('ring', boolParam)
  const [showNodes, setShowNodes] = useUrlState('nodes', intParam(defaultNodes))
  const [showGraph, setShowGraph] = useUrlState('graph', boolParam)
  const [opacity, setOpacity] = useUrlState('o', numParam(0.5))
  const [wing, setWing] = useUrlState('w', numParam(0.4))
  const [angle, setAngle] = useUrlState('ang', intParam(45))
  const [bezierN, setBezierN] = useUrlState('bn', intParam(20))
  const [nodeApproach, setNodeApproach] = useUrlState('na', numParam(0.5))
  const [creaseSkip, setCreaseSkip] = useUrlState('cs', intParam(1))
  const [widthScale, setWidthScale] = useUrlState('ws', numParam(1))

  useActions({
    toggleSinglePoly: { label: 'Toggle single-poly', group: 'Config', defaultBindings: ['s'], handler: () => setSinglePoly(!singlePoly) },
    toggleRingPoints: { label: 'Toggle ring points', group: 'Config', defaultBindings: ['r'], handler: () => setShowRing(!showRing) },
    toggleNodes: { label: 'Cycle nodes (off → endpoints → all)', group: 'Config', defaultBindings: ['n'], handler: () => setShowNodes((showNodes + 1) % 3) },
    toggleGraph: { label: 'Toggle graph overlay', group: 'Config', defaultBindings: ['g'], handler: () => setShowGraph(!showGraph) },
    opacityUp: { label: 'Increase opacity', group: 'Config', defaultBindings: ['shift+up'], handler: () => setOpacity(Math.min(1, opacity + 0.1)) },
    opacityDown: { label: 'Decrease opacity', group: 'Config', defaultBindings: ['shift+down'], handler: () => setOpacity(Math.max(0.1, opacity - 0.1)) },
    bplUp: { label: 'Increase BPL', group: 'Config', defaultBindings: ['b'], handler: () => setBezierN(Math.min(40, bezierN + 2)) },
    bplDown: { label: 'Decrease BPL', group: 'Config', defaultBindings: ['shift+b'], handler: () => setBezierN(Math.max(1, bezierN - 2)) },
    creaseUp: { label: 'Increase crease skip', group: 'Config', defaultBindings: ['c'], handler: () => setCreaseSkip(Math.min(4, creaseSkip + 1)) },
    creaseDown: { label: 'Decrease crease skip', group: 'Config', defaultBindings: ['shift+c'], handler: () => setCreaseSkip(Math.max(0, creaseSkip - 1)) },
    approachUp: { label: 'Increase approach', group: 'Config', defaultBindings: ['a'], handler: () => setNodeApproach(Math.min(3, nodeApproach + 0.1)) },
    approachDown: { label: 'Decrease approach', group: 'Config', defaultBindings: ['shift+a'], handler: () => setNodeApproach(Math.max(0, nodeApproach - 0.1)) },
    widthUp: { label: 'Increase width scale', group: 'Config', defaultBindings: ['w'], handler: () => setWidthScale(Math.min(3, widthScale + 0.1)) },
    widthDown: { label: 'Decrease width scale', group: 'Config', defaultBindings: ['shift+w'], handler: () => setWidthScale(Math.max(0, widthScale - 0.1)) },
    exportScene: { label: 'Export scene (JSON)', group: 'File', defaultBindings: ['cmd+shift+e', 'ctrl+shift+e'], handler: () => exportScene() },
    importScene: { label: 'Import scene (JSON)', group: 'File', defaultBindings: ['cmd+i', 'ctrl+i'], handler: () => fileInputRef.current?.click() },
    toggleEdit: { label: 'Toggle edit mode', group: 'Edit', defaultBindings: ['e'], handler: () => { setEditMode(m => { const v = !m; sessionStorage.setItem('geo-sankey-edit', v ? '1' : ''); return v }); setSelection(null); setEdgeSource(null) } },
    deleteSelected: { label: 'Delete selected', group: 'Edit', defaultBindings: ['Backspace', 'Delete'], handler: () => {
      if (!selection) return
      if (selection.type === 'node') deleteNode(selection.id)
      else deleteEdge(selection.from, selection.to)
    }},
    undo: { label: 'Undo', group: 'Edit', defaultBindings: ['cmd+z', 'ctrl+z'], handler: undo },
    redo: { label: 'Redo', group: 'Edit', defaultBindings: ['cmd+shift+z', 'ctrl+shift+z'], handler: redo },
  })

  const exportScene = useCallback(() => {
    const scene = {
      version: 1,
      graph,
      opts: { color, pxPerWeight, refLat, wing, angle, bezierN, nodeApproach, widthScale, creaseSkip },
      view: { lat: llz.lat, lng: llz.lng, zoom: llz.zoom },
    }
    const json = JSON.stringify(scene, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [graph, color, pxPerWeight, refLat, wing, angle, bezierN, nodeApproach, widthScale, creaseSkip, llz, title])

  const importScene = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const scene = JSON.parse(reader.result as string)
        if (scene.graph?.nodes && scene.graph?.edges) {
          setGraph(scene.graph)
          if (scene.opts?.wing != null) setWing(scene.opts.wing)
          if (scene.opts?.angle != null) setAngle(scene.opts.angle)
          if (scene.opts?.bezierN != null) setBezierN(scene.opts.bezierN)
          if (scene.opts?.nodeApproach != null) setNodeApproach(scene.opts.nodeApproach)
          if (scene.opts?.widthScale != null) setWidthScale(scene.opts.widthScale)
          if (scene.opts?.creaseSkip != null) setCreaseSkip(scene.opts.creaseSkip)
          if (scene.view) setLLZ({ lat: scene.view.lat, lng: scene.view.lng, zoom: scene.view.zoom })
        }
      } catch (e) {
        console.error('Import failed:', e)
      }
    }
    reader.readAsText(file)
  }, [])

  const graphOpts: FlowGraphOpts = {
    refLat, zoom: llz.zoom, color,
    pxPerWeight: pxPerWeight * widthScale,
    wing, angle, bezierN, nodeApproach, creaseSkip,
  }

  const geojson = useMemo(() =>
    singlePoly
      ? renderFlowGraphSinglePoly(graph, graphOpts)
      : renderFlowGraph(graph, graphOpts),
  [graph, llz.zoom, singlePoly, wing, angle, bezierN, nodeApproach, creaseSkip, widthScale])

  const nodePoints = useMemo(() => {
    const filter = showNodes === 2 || editMode ? 'all' as const : showNodes === 1 ? 'endpoints' as const : 'all' as const
    return renderNodes(graph, filter)
  }, [graph, showNodes, editMode])

  const debugGeo = useMemo(() =>
    showGraph ? renderFlowGraphDebug(graph, graphOpts) : null,
  [graph, showGraph, llz.zoom, wing, angle, bezierN, nodeApproach, widthScale])

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
        const label = p.id ? `${p.label ?? p.id}` : `pt #${p.idx}`
        setTooltip({ x: e.point.x, y: e.point.y, text: `${label}\n${lat.toFixed(6)}, ${lon.toFixed(6)}` })
      } else if (p.bearing != null) {
        setTooltip({ x: e.point.x, y: e.point.y, text: `edge #${p.idx} bearing:${p.bearing}\u00B0\n${p.from} → ${p.to}` })
      }
    } else {
      setTooltip(null)
    }
  }, [])

  // Edit mode: click = select node or deselect, double-click = add node
  const onMapClick = useCallback((e: any) => {
    if (!editMode) return
    const nodeFeatures = e.features?.filter((f: any) => f.layer?.id === 'node-circles')
    if (nodeFeatures?.length) {
      const nodeId = nodeFeatures[0].properties.id
      if (edgeSource) {
        addEdge(edgeSource, nodeId)
        setEdgeSource(null)
      } else {
        setSelection({ type: 'node', id: nodeId })
      }
      return
    }
    // Clicked empty map — deselect
    if (edgeSource) {
      setEdgeSource(null)
    }
    setSelection(null)
  }, [editMode, edgeSource, addEdge, setSelection, setEdgeSource])

  const onMapDblClick = useCallback((e: any) => {
    if (!editMode) return
    e.preventDefault()
    addNode([e.lngLat.lat, e.lngLat.lng])
  }, [editMode, addNode])

  // Edit mode: drag with document-level listeners for reliability
  const mapRef = useRef<any>(null)
  const onNodeDragStart = useCallback((e: any) => {
    if (!editMode) return
    const nodeFeatures = e.features?.filter((f: any) => f.layer?.id === 'node-circles')
    if (nodeFeatures?.length) {
      setDragging(nodeFeatures[0].properties.id)
    }
  }, [editMode])

  const graphRef = useRef(graph)
  graphRef.current = graph

  // Test hook: expose current graph + map ref + action callbacks on window for e2e tests.
  useEffect(() => {
    ;(window as any).__geoSankey = {
      graph,
      mapRef,
      dispatch,
      undo,
      redo,
      pastLen: gs.past.length,
      futureLen: gs.future.length,
    }
  }, [graph, gs.past.length, gs.future.length, undo, redo])

  useEffect(() => {
    if (!dragging || !mapRef.current) return
    const map = mapRef.current.getMap()
    const canvas = map.getCanvas()
    canvas.style.cursor = 'grabbing'
    // Snapshot pre-drag state ONCE for a single history entry
    const preDrag = graphRef.current
    let moved = false
    const onMove = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const { lng, lat } = map.unproject([ev.clientX - rect.left, ev.clientY - rect.top])
      if (!moved) { pushHistory(preDrag); moved = true }
      setGraph(g => ({
        ...g,
        nodes: g.nodes.map(n => n.id === dragging ? { ...n, pos: [lat, lng] } : n),
      }))
    }
    const onUp = () => {
      setDragging(null)
      canvas.style.cursor = ''
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      canvas.style.cursor = ''
    }
  }, [dragging, setGraph, pushHistory])

  const { theme } = useTheme()

  return (
    <div className="example">
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="map-container" style={{ position: 'relative' }}>
        {editMode && <div style={{
          position: 'absolute', top: 8, left: 8, zIndex: 21,
          background: 'rgba(245, 158, 11, 0.95)', color: '#111',
          padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
        }}>EDIT{edgeSource ? ` (edge from ${edgeSource} — click dest)` : ''}</div>}
        <Drawer sections={[
          {
            id: 'defaults',
            title: 'Page Defaults',
            defaultOpen: true,
            children: <>
              <Row label="Width"><Slider value={widthScale} onChange={setWidthScale} min={0} max={3} step={0.1} fmt={v => v.toFixed(1)} /></Row>
              <Row label="Opacity"><Slider value={opacity} onChange={setOpacity} min={0.1} max={1} step={0.05} fmt={v => v.toFixed(2)} /></Row>
              <Row label="Wing"><Slider value={wing} onChange={setWing} min={0} max={1} step={0.05} fmt={v => v.toFixed(2)} /></Row>
              <Row label="Angle"><Slider value={angle} onChange={setAngle} min={1} max={60} step={1} /></Row>
              <Row label="BPL"><Slider value={bezierN} onChange={setBezierN} min={1} max={40} step={1} /></Row>
              <Row label="Approach"><Slider value={nodeApproach} onChange={setNodeApproach} min={0} max={3} step={0.1} fmt={v => v.toFixed(1)} /></Row>
              <Row label="Crease"><Slider value={creaseSkip} onChange={setCreaseSkip} min={0} max={4} step={1} /></Row>
            </>,
          },
          {
            id: 'view',
            title: 'View',
            defaultOpen: true,
            children: <>
              <Check label="Single-poly" checked={singlePoly} onChange={setSinglePoly} />
              <Check label="Ring points" checked={showRing} onChange={setShowRing} />
              <Check label="Graph overlay" checked={showGraph} onChange={setShowGraph} />
              <Row label="Nodes">
                <select value={showNodes} onChange={e => setShowNodes(parseInt(e.target.value))}
                  style={{ fontSize: 12, background: 'var(--bg, #11111b)', color: 'var(--fg, #cdd6f4)',
                    border: '1px solid var(--border, #45475a)', borderRadius: 4, padding: '2px 4px' }}>
                  <option value={0}>off</option>
                  <option value={1}>endpoints</option>
                  <option value={2}>all</option>
                </select>
              </Row>
            </>,
          },
        ]} />
        <MapGL
          ref={mapRef}
          initialViewState={{ longitude: llz.lng, latitude: llz.lat, zoom: llz.zoom }}
          style={{ width: '100%', height: '100%' }}
          mapStyle={MAP_STYLES[theme]}
          onMove={dragging ? undefined : onMove}
          onMouseMove={dragging ? undefined : onHover}
          onMouseDown={editMode ? onNodeDragStart : undefined}
          onDblClick={editMode ? onMapDblClick : undefined}
          onClick={editMode ? onMapClick : undefined}
          onMouseLeave={() => setTooltip(null)}
          interactiveLayerIds={[
            ...(showRing ? ['ring-edge-lines', 'ring-edge-labels', 'ring-circles'] : []),
            ...(showNodes > 0 || editMode ? ['node-circles'] : []),
          ]}
          dragPan={!dragging}
        >
          <Source id="flows" type="geojson" data={geojson}>
            <Layer id="flows-fill" type="fill" paint={{ 'fill-color': ['get', 'color'], 'fill-opacity': opacity }} />
          </Source>
          {(showNodes > 0 || editMode) && (
            <Source id="nodes" type="geojson" data={nodePoints}>
              <Layer id="node-circles" type="circle"
                paint={{
                  'circle-radius': ['case',
                    ['==', ['get', 'id'], selection?.type === 'node' ? selection.id : ''], 8,
                    ['coalesce', ['get', 'radius'], 5],
                  ],
                  'circle-color': ['case',
                    ['==', ['get', 'id'], selection?.type === 'node' ? selection.id : ''], '#14B8A6',
                    ['coalesce', ['get', 'color'], '#fff'],
                  ],
                  'circle-stroke-color': ['case',
                    ['==', ['get', 'id'], selection?.type === 'node' ? selection.id : ''], '#fff',
                    '#000',
                  ],
                  'circle-stroke-width': ['case',
                    ['==', ['get', 'id'], selection?.type === 'node' ? selection.id : ''], 2.5,
                    1.5,
                  ],
                }} />
              <Layer id="node-labels" type="symbol"
                layout={{
                  'text-field': ['get', 'label'],
                  'text-size': 11,
                  'text-offset': [0, 1.4],
                  'text-anchor': 'top',
                  'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'],
                  'text-allow-overlap': true,
                }}
                paint={{
                  'text-color': ['coalesce', ['get', 'labelColor'], '#fff'],
                  'text-halo-color': 'rgba(0,0,0,0.8)',
                  'text-halo-width': 1.5,
                }} />
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
        {editMode && selection && (() => {
        if (selection.type === 'node') {
          const node = graph.nodes.find(n => n.id === selection.id)
          if (!node) return null
          return (
            <NodeOverlay
              key={node.id}
              nodeId={node.id}
              label={node.label ?? ''}
              bearing={round(node.bearing ?? 90)}
              pos={node.pos}
              mapRef={mapRef}
              onUpdateBearing={b => updateNode(node.id, { bearing: b })}
              onBeginRotate={() => pushHistory(graphRef.current)}
              onRotateTransient={b => setGraph(g => ({ ...g, nodes: g.nodes.map(n => n.id === node.id ? { ...n, bearing: b } : n) }))}
              onUpdateLabel={l => updateNode(node.id, { label: l || undefined } as any)}
              onUpdatePos={p => updateNode(node.id, { pos: p })}
              onAddEdge={() => { setEdgeSource(node.id); setSelection(null) }}
              onDelete={() => deleteNode(node.id)}
            />
          )
        }
        if (selection.type === 'edge') {
          const edge = graph.edges.find(e => e.from === selection.from && e.to === selection.to)
          if (!edge) return null
          const panelStyle: React.CSSProperties = {
            position: 'absolute', top: 8, right: 8, background: 'var(--bg-surface, #1e1e2e)', color: 'var(--fg, #cdd6f4)',
            border: '1px solid var(--border, #45475a)', borderRadius: 8, padding: '12px 16px', fontSize: 13, zIndex: 20, minWidth: 200,
          }
          const inputStyle: React.CSSProperties = { background: 'var(--bg, #11111b)', color: 'var(--fg, #cdd6f4)', border: '1px solid var(--border, #45475a)', borderRadius: 4, padding: '2px 6px', width: '100%', fontSize: 12 }
          return (
            <div style={panelStyle}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Edge: {edge.from} → {edge.to}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 11, minWidth: 50, opacity: 0.7 }}>Weight</span>
                <input style={inputStyle} type="number" value={edge.weight} onChange={e => updateEdge(edge.from, edge.to, { weight: parseFloat(e.target.value) || 1 })} />
              </div>
              <div style={{ marginTop: 8 }}>
                <button onClick={() => deleteEdge(edge.from, edge.to)} style={{ fontSize: 11, color: '#ef4444' }}>Delete</button>
              </div>
            </div>
          )
        }
        return null
        })()}
      </div>
      <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }}
        onChange={e => { if (e.target.files?.[0]) importScene(e.target.files[0]); e.target.value = '' }} />
    </div>
  )
}
