import { useMemo, useCallback, useState, useRef, useEffect } from 'react'
import MapGL, { Source, Layer } from 'react-map-gl/maplibre'
import { useUrlState } from 'use-prms'
import type { Param } from 'use-prms'
import { useActions } from 'use-kbd'
import { renderFlowGraph, renderFlowGraphSinglePoly, renderFlowGraphDebug, renderEdgeCenterlines, renderNodes } from 'geo-sankey'
import type { FlowGraph, FlowGraphOpts } from 'geo-sankey'
import BearingDial from './BearingDial'
import Drawer, { Row, Slider, Check } from './Drawer'
import NodeOverlay from './NodeOverlay'
import SelectionSection from './SelectionSection'
import { useGraphState } from './hooks/useGraphState'
import { useGraphSelection, selRefEq } from './hooks/useGraphSelection'
import type { SelectionRef } from './hooks/useGraphSelection'
import { useSceneIO } from './useSceneIO'
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

export default function FlowMapView({ graph: initialGraph, title, description, color, pxPerWeight, refLat, defaults, defaultNodes = 0 }: FlowMapViewProps) {
  const gs = useGraphState(initialGraph)
  const { graph, setGraph, pushGraph, pushHistory, undo, redo, dispatch } = gs
  const sel = useGraphSelection(graph)
  const { selections, setSelections, selection, toggleOrReplace, selectedNodes, selectedEdges, selectedNodeIds, selectedEdgeIds, resolvedWeights, nodeRoleOf, aggEdge } = sel
  const [llz, setLLZ] = useLLZ(defaults)
  const mapRef = useRef<any>(null)
  const [editMode, setEditMode] = useState(() => sessionStorage.getItem('geo-sankey-edit') === '1')
  const [dragging, setDragging] = useState<string | null>(null)
  const [edgeSource, setEdgeSource] = useState<string | null>(null)

  // Graph mutation helpers
  const renameNode = useCallback((oldId: string, newId: string) => {
    if (!newId || newId === oldId) return
    pushGraph(g => {
      if (g.nodes.some(n => n.id === newId)) return g  // conflict — silently no-op
      return {
        nodes: g.nodes.map(n => n.id === oldId ? { ...n, id: newId } : n),
        edges: g.edges.map(e => ({
          ...e,
          from: e.from === oldId ? newId : e.from,
          to: e.to === oldId ? newId : e.to,
        })),
      }
    })
    setSelections(prev => prev.map(r =>
      r.type === 'node' && r.id === oldId ? { type: 'node', id: newId }
      : r.type === 'edge' && (r.from === oldId || r.to === oldId) ? {
        type: 'edge',
        from: r.from === oldId ? newId : r.from,
        to: r.to === oldId ? newId : r.to,
      }
      : r
    ))
  }, [pushGraph, setSelections])
  const duplicateNodes = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    const offset = 0.001  // ~100m at mid-latitudes — visible but adjacent
    const ts = Date.now().toString(36)
    const renames = new Map<string, string>(ids.map((id, i) => [id, `${id}-copy${ts}-${i}`]))
    pushGraph(g => {
      const newNodes = g.nodes.filter(n => idSet.has(n.id)).map(n => ({
        ...n,
        id: renames.get(n.id)!,
        pos: [n.pos[0] + offset, n.pos[1] + offset] as [number, number],
      }))
      // Edges between two copied nodes get duplicated; edges crossing the
      // selection boundary stay attached to the originals.
      const newEdges = g.edges
        .filter(e => idSet.has(e.from) && idSet.has(e.to))
        .map(e => ({ ...e, from: renames.get(e.from)!, to: renames.get(e.to)! }))
      return { nodes: [...g.nodes, ...newNodes], edges: [...g.edges, ...newEdges] }
    })
    setSelections([...renames.values()].map(id => ({ type: 'node' as const, id })))
  }, [pushGraph, setSelections])
  const updateNode = useCallback((id: string, patch: Partial<{ pos: [number, number]; bearing: number; label: string; velocity: number }>) => {
    pushGraph(g => ({
      ...g,
      nodes: g.nodes.map(n => n.id === id ? { ...n, ...patch } : n),
    }))
  }, [pushGraph])
  const addNode = useCallback((pos: [number, number]) => {
    const id = `n${Date.now()}`
    pushGraph(g => ({ ...g, nodes: [...g.nodes, { id, pos }] }))
    setSelections([{ type: 'node', id }])
  }, [pushGraph, setSelections])
  const deleteNode = useCallback((id: string) => {
    pushGraph(g => ({
      nodes: g.nodes.filter(n => n.id !== id),
      edges: g.edges.filter(e => e.from !== id && e.to !== id),
    }))
    setSelections(prev => prev.filter(r => !(r.type === 'node' && r.id === id)))
  }, [pushGraph, setSelections])
  const addEdge = useCallback((from: string, to: string) => {
    if (from === to) return
    // Default new edges to 'auto' weight — flow-conservation will derive
    // the value from upstream inputs (sources stay explicit since they
    // have no inputs to derive from).
    pushGraph(g => {
      const fromHasInputs = g.edges.some(e => e.to === from)
      const weight: number | 'auto' = fromHasInputs ? 'auto' : 10
      return { ...g, edges: [...g.edges, { from, to, weight }] }
    })
    setSelections([{ type: 'edge', from, to }])
  }, [pushGraph, setSelections])
  const updateEdge = useCallback((from: string, to: string, patch: Partial<{ weight: number | 'auto' }>) => {
    pushGraph(g => ({
      ...g,
      edges: g.edges.map(e => e.from === from && e.to === to ? { ...e, ...patch } : e),
    }))
  }, [pushGraph])
  const updateEdgeStyle = useCallback((from: string, to: string, patch: Partial<{ color: string; opacity: number; widthScale: number }>) => {
    pushGraph(g => ({
      ...g,
      edges: g.edges.map(e => e.from === from && e.to === to
        ? { ...e, style: { ...e.style, ...patch } }
        : e),
    }))
  }, [pushGraph])
  const deleteEdge = useCallback((from: string, to: string) => {
    pushGraph(g => ({ ...g, edges: g.edges.filter(e => !(e.from === from && e.to === to)) }))
    setSelections(prev => prev.filter(r => !(r.type === 'edge' && r.from === from && r.to === to)))
  }, [pushGraph, setSelections])
  const reverseEdge = useCallback((from: string, to: string) => {
    pushGraph(g => {
      // Refuse if the reverse already exists (would conflict).
      if (g.edges.some(e => e.from === to && e.to === from)) return g
      return {
        ...g,
        edges: g.edges.map(e => e.from === from && e.to === to
          ? { ...e, from: to, to: from }
          : e),
      }
    })
    setSelections([{ type: 'edge', from: to, to: from }])
  }, [pushGraph, setSelections])
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
  const [widthUnit, setWidthUnit] = useUrlState<'px' | 'm'>('wu', {
    encode: v => v === 'px' ? undefined : v,
    decode: s => s === 'm' ? 'm' : 'px',
  })
  // Default m/weight chosen so that at the example's default zoom the
  // ribbon is roughly the same width as the px-mode default — gives a
  // sensible starting point when the user toggles units.
  const [mPerWeight, setMPerWeight] = useUrlState('mpw', numParam(2))

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
    exportSceneJSON: { label: 'Export scene (JSON)', group: 'File', defaultBindings: ['cmd+shift+e', 'ctrl+shift+e'], handler: () => sceneIO.exportSceneJSON() },
    exportSceneTS: { label: 'Export scene (TS file)', group: 'File', defaultBindings: ['cmd+alt+e', 'ctrl+alt+e'], handler: () => sceneIO.exportSceneTS() },
    importScene: { label: 'Import scene (file)', group: 'File', defaultBindings: ['cmd+i', 'ctrl+i'], handler: () => sceneIO.openImport() },
    copyScene: { label: 'Copy scene as TS (full)', group: 'File', defaultBindings: ['cmd+shift+c', 'ctrl+shift+c'], handler: () => sceneIO.copySceneAsTS() },
    copyGraph: { label: 'Copy graph as TS (paste into source)', group: 'File', defaultBindings: ['cmd+shift+g', 'ctrl+shift+g'], handler: () => sceneIO.copyGraphAsTS() },
    pasteScene: { label: 'Paste scene / graph', group: 'File', defaultBindings: ['cmd+shift+v', 'ctrl+shift+v'], handler: () => sceneIO.openPaste() },
    toggleEdit: { label: 'Toggle edit mode', group: 'Edit', defaultBindings: ['e'], handler: () => { setEditMode(m => { const v = !m; sessionStorage.setItem('geo-sankey-edit', v ? '1' : ''); return v }); setSelections([]); setEdgeSource(null) } },
    deleteSelected: { label: 'Delete selected', group: 'Edit', defaultBindings: ['Backspace', 'Delete'], handler: () => {
      if (selections.length === 0) return
      // Snapshot for a single undo even when deleting several
      for (const r of selections) {
        if (r.type === 'node') deleteNode(r.id)
        else deleteEdge(r.from, r.to)
      }
    }},
    clearSelection: { label: 'Clear selection', group: 'Edit', defaultBindings: ['Escape'], handler: () => setSelections([]) },
    duplicateSelection: { label: 'Duplicate selected nodes', group: 'Edit', defaultBindings: ['cmd+d', 'ctrl+d'], handler: () => duplicateNodes(selectedNodeIds) },
    undo: { label: 'Undo', group: 'Edit', defaultBindings: ['cmd+z', 'ctrl+z'], handler: undo },
    redo: { label: 'Redo', group: 'Edit', defaultBindings: ['cmd+shift+z', 'ctrl+shift+z'], handler: redo },
  })

  const sceneIO = useSceneIO({
    graph,
    opts: { color, pxPerWeight, refLat, wing, angle, bezierN, nodeApproach, widthScale, creaseSkip },
    view: { lat: llz.lat, lng: llz.lng, zoom: llz.zoom },
    title,
    pushGraph,
    applyOpts: o => {
      if (o.wing != null) setWing(o.wing)
      if (o.angle != null) setAngle(o.angle)
      if (o.bezierN != null) setBezierN(o.bezierN)
      if (o.nodeApproach != null) setNodeApproach(o.nodeApproach)
      if (o.widthScale != null) setWidthScale(o.widthScale)
      if (o.creaseSkip != null) setCreaseSkip(o.creaseSkip)
    },
    setView: v => setLLZ(v),
    mapRef,
  })

  const graphOpts: FlowGraphOpts = {
    refLat, zoom: llz.zoom, color,
    pxPerWeight: pxPerWeight * widthScale,
    ...(widthUnit === 'm' ? { mPerWeight: mPerWeight * widthScale } : {}),
    wing, angle, bezierN, nodeApproach, creaseSkip,
  }

  const geojson = useMemo(() =>
    singlePoly
      ? renderFlowGraphSinglePoly(graph, graphOpts)
      : renderFlowGraph(graph, graphOpts),
  [graph, llz.zoom, singlePoly, wing, angle, bezierN, nodeApproach, creaseSkip, widthScale, widthUnit, mPerWeight])

  const nodePoints = useMemo(() => {
    const filter = showNodes === 2 || editMode ? 'all' as const : showNodes === 1 ? 'endpoints' as const : 'all' as const
    return renderNodes(graph, filter)
  }, [graph, showNodes, editMode])

  const edgeCenterlines = useMemo(
    () => editMode ? renderEdgeCenterlines(graph, graphOpts) : null,
    [editMode, graph, llz.zoom, bezierN, nodeApproach, widthScale, widthUnit, mPerWeight],
  )

  const applyEdgeStyle = useCallback((patch: Partial<{ color: string; opacity: number; widthScale: number }>) => {
    for (const e of selectedEdges) updateEdgeStyle(e.from, e.to, patch)
  }, [selectedEdges, updateEdgeStyle])

  const applyEdgeWeight = useCallback((weight: number | 'auto') => {
    for (const e of selectedEdges) updateEdge(e.from, e.to, { weight })
  }, [selectedEdges, updateEdge])

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

  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)
  const onHover = useCallback((e: any) => {
    setCursor({ x: e.point.x, y: e.point.y })
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

  // Edit mode: click = select/replace, shift-click = toggle in set, dbl-click = add node
  const onMapClick = useCallback((e: any) => {
    if (!editMode) return
    const shift = (e.originalEvent as MouseEvent | undefined)?.shiftKey
    const nodeFeatures = e.features?.filter((f: any) => f.layer?.id === 'node-circles')
    const centerlineFeatures = e.features?.filter((f: any) => f.layer?.id === 'edge-centerlines-hit')
    const edgeFeatures = e.features?.filter((f: any) => f.layer?.id === 'flows-fill')

    // Node clicks take precedence over ribbon clicks
    if (nodeFeatures?.length) {
      const nodeId = nodeFeatures[0].properties.id
      if (edgeSource) {
        addEdge(edgeSource, nodeId)
        setEdgeSource(null)
        return
      }
      toggleOrReplace({ type: 'node', id: nodeId }, !!shift)
      return
    }
    if (centerlineFeatures?.length) {
      const p = centerlineFeatures[0].properties
      if (p.from && p.to) {
        toggleOrReplace({ type: 'edge', from: p.from, to: p.to }, !!shift)
        return
      }
    }
    if (edgeFeatures?.length) {
      const p = edgeFeatures[0].properties
      // Only edge ribbons have from/to (through-node bodies in singlePoly don't)
      if (p.from && p.to) {
        toggleOrReplace({ type: 'edge', from: p.from, to: p.to }, !!shift)
        return
      }
    }
    // Clicked empty map
    if (edgeSource) setEdgeSource(null)
    if (!shift) setSelections([])
  }, [editMode, edgeSource, addEdge, setSelections, setEdgeSource])

  const splitEdgeAt = useCallback((from: string, to: string, pos: [number, number]) => {
    const id = `n${Date.now()}`
    pushGraph(g => {
      const e = g.edges.find(x => x.from === from && x.to === to)
      if (!e) return g
      const baseStyle = e.style
      // New through-node inherits no bearing/velocity (auto-derived from edge tangent
      // because it has 1 in / 1 out). Splits preserve the edge's weight on the first
      // half (explicit) and let the second half ride 'auto' through-node flow.
      const newNode = { id, pos }
      const firstHalf = { from, to: id, weight: e.weight, ...(baseStyle ? { style: baseStyle } : {}) }
      const secondHalf = { from: id, to, weight: 'auto' as const, ...(baseStyle ? { style: baseStyle } : {}) }
      return {
        nodes: [...g.nodes, newNode],
        edges: g.edges.flatMap(x => x === e ? [firstHalf, secondHalf] : [x]),
      }
    })
    setSelections([{ type: 'node', id }])
  }, [pushGraph, setSelections])

  const onMapDblClick = useCallback((e: any) => {
    if (!editMode) return
    e.preventDefault()
    // If dbl-click landed on an edge centerline, split that edge instead of
    // adding a free-floating node.
    const map = mapRef.current?.getMap()
    if (map) {
      const hits = map.queryRenderedFeatures([e.point.x, e.point.y], { layers: ['edge-centerlines-hit'] })
      if (hits?.length) {
        const p = hits[0].properties as { from?: string; to?: string }
        if (p.from && p.to) {
          splitEdgeAt(p.from, p.to, [e.lngLat.lat, e.lngLat.lng])
          return
        }
      }
    }
    addNode([e.lngLat.lat, e.lngLat.lng])
  }, [editMode, addNode])

  // Edit mode: drag with document-level listeners for reliability
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
      selections,
      setSelections,
      pastLen: gs.pastLen,
      futureLen: gs.futureLen,
    }
  }, [graph, gs.pastLen, gs.futureLen, undo, redo, selections, setSelections])

  useEffect(() => {
    if (!dragging || !mapRef.current) return
    const map = mapRef.current.getMap()
    const canvas = map.getCanvas()
    canvas.style.cursor = 'grabbing'
    const preDrag = graphRef.current
    // If the dragged node is part of a multi-selection, the whole group moves
    // together by the same lat/lon delta. Snapshot every selected node's
    // origin position so we can compute deltas from there each frame.
    const selIds = selections.filter(r => r.type === 'node').map(r => r.id)
    const moveIds = selIds.includes(dragging) && selIds.length > 1 ? selIds : [dragging]
    const origin = new Map<string, [number, number]>()
    for (const id of moveIds) {
      const n = preDrag.nodes.find(x => x.id === id)
      if (n) origin.set(id, [n.pos[0], n.pos[1]])
    }
    const anchor = origin.get(dragging)!
    let moved = false
    const onMove = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const { lng, lat } = map.unproject([ev.clientX - rect.left, ev.clientY - rect.top])
      const dLat = lat - anchor[0]
      const dLon = lng - anchor[1]
      if (!moved) { pushHistory(preDrag); moved = true }
      setGraph(g => ({
        ...g,
        nodes: g.nodes.map(n => {
          const start = origin.get(n.id)
          return start ? { ...n, pos: [start[0] + dLat, start[1] + dLon] as [number, number] } : n
        }),
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
  }, [dragging, selections, setGraph, pushHistory])

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
              <Row label="Width">
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', width: '100%' }}>
                  <select value={widthUnit} onChange={e => setWidthUnit(e.target.value as 'px' | 'm')}
                    style={{ fontSize: 11, background: 'var(--bg, #11111b)', color: 'var(--fg, #cdd6f4)',
                      border: '1px solid var(--border, #45475a)', borderRadius: 4, padding: '2px 4px' }}>
                    <option value="px">px×</option>
                    <option value="m">m</option>
                  </select>
                  {widthUnit === 'px'
                    ? <Slider value={widthScale} onChange={setWidthScale} min={0} max={3} step={0.1} fmt={v => v.toFixed(1)} />
                    : <Slider value={mPerWeight} onChange={setMPerWeight} min={0.1} max={50} step={0.1} fmt={v => `${v.toFixed(1)}m`} />
                  }
                </div>
              </Row>
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
          ...(selections.length > 0 ? [{
            id: 'selection',
            title: `Selection (${selections.length})`,
            defaultOpen: true,
            children: <SelectionSection
              graph={graph}
              selections={selections}
              selectedNodes={selectedNodes}
              selectedEdges={selectedEdges}
              resolvedWeights={resolvedWeights}
              singlePoly={singlePoly}
              nodeRoleOf={nodeRoleOf}
              aggEdge={aggEdge as any}
              updateNode={updateNode}
              renameNode={renameNode}
              deleteNode={deleteNode}
              addEdge={addEdge}
              deleteEdge={deleteEdge}
              reverseEdge={reverseEdge}
              setEdgeSource={setEdgeSource}
              setSelections={setSelections}
              applyEdgeStyle={applyEdgeStyle}
              applyEdgeWeight={applyEdgeWeight}
            />,
          }] : []),
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
            ...(editMode ? ['flows-fill', 'edge-centerlines-hit'] : []),
          ]}
          dragPan={!dragging}
        >
          <Source id="flows" type="geojson" data={geojson}>
            <Layer id="flows-fill" type="fill" paint={{
              'fill-color': ['get', 'color'],
              'fill-opacity': ['*', opacity, ['coalesce', ['get', 'opacity'], 1]],
            }} />
          </Source>
          {editMode && edgeCenterlines && (
            <Source id="edge-centerlines" type="geojson" data={edgeCenterlines}>
              <Layer id="edge-centerlines-hit" type="line" paint={{
                'line-color': '#000',
                'line-opacity': 0,
                'line-width': 16,
              }} />
              <Layer id="edge-centerlines-sel-halo" type="line"
                filter={['in', ['get', 'id'], ['literal', selectedEdgeIds]]}
                paint={{
                  'line-color': '#000',
                  'line-width': 5,
                  'line-opacity': 0.7,
                }} />
              <Layer id="edge-centerlines-sel" type="line"
                filter={['in', ['get', 'id'], ['literal', selectedEdgeIds]]}
                paint={{
                  'line-color': '#facc15',
                  'line-width': 2.5,
                  'line-dasharray': [2, 1.5],
                }} />
              <Layer id="edge-centerlines-arrow" type="symbol"
                filter={['in', ['get', 'id'], ['literal', selectedEdgeIds]]}
                layout={{
                  'symbol-placement': 'line-center',
                  'text-field': '▶',
                  'text-size': 18,
                  'text-rotation-alignment': 'map',
                  'text-keep-upright': false,
                  'text-allow-overlap': true,
                }}
                paint={{
                  'text-color': '#facc15',
                  'text-halo-color': '#000',
                  'text-halo-width': 1.5,
                }} />
            </Source>
          )}
          {(showNodes > 0 || editMode) && (
            <Source id="nodes" type="geojson" data={nodePoints}>
              <Layer id="node-circles" type="circle"
                paint={{
                  'circle-radius': ['case',
                    ['in', ['get', 'id'], ['literal', selectedNodeIds]], 8,
                    ['coalesce', ['get', 'radius'], 5],
                  ],
                  'circle-color': ['case',
                    ['in', ['get', 'id'], ['literal', selectedNodeIds]], '#14B8A6',
                    ['coalesce', ['get', 'color'], '#fff'],
                  ],
                  'circle-stroke-color': ['case',
                    ['in', ['get', 'id'], ['literal', selectedNodeIds]], '#fff',
                    '#000',
                  ],
                  'circle-stroke-width': ['case',
                    ['in', ['get', 'id'], ['literal', selectedNodeIds]], 2.5,
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
        {editMode && edgeSource && cursor && (() => {
          const src = graph.nodes.find(n => n.id === edgeSource)
          const map = mapRef.current?.getMap?.()
          if (!src || !map) return null
          const sp = map.project([src.pos[1], src.pos[0]])
          return (
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 23 }}>
              <line x1={sp.x} y1={sp.y} x2={cursor.x} y2={cursor.y}
                stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 4" opacity={0.85} />
              <circle cx={cursor.x} cy={cursor.y} r={5} fill="none" stroke="#f59e0b" strokeWidth={1.5} />
            </svg>
          )
        })()}
        {editMode && selection && selection.type === 'node' && (() => {
          const node = graph.nodes.find(n => n.id === selection.id)
          if (!node) return null
          return (
            <NodeOverlay
              key={node.id}
              nodeId={node.id}
              label={node.label ?? ''}
              bearing={round(node.bearing ?? 90)}
              pos={node.pos}
              velocity={node.velocity}
              refLat={refLat}
              mapRef={mapRef}
              onBeginRotate={() => pushHistory(graphRef.current)}
              onRotateTransient={b => setGraph(g => ({ ...g, nodes: g.nodes.map(n => n.id === node.id ? { ...n, bearing: b } : n) }))}
              onBeginVelocity={() => pushHistory(graphRef.current)}
              onVelocityTransient={v => setGraph(g => ({ ...g, nodes: g.nodes.map(n => n.id === node.id ? { ...n, velocity: v } : n) }))}
              onResetVelocity={() => updateNode(node.id, { velocity: undefined } as any)}
            />
          )
        })()}
      </div>
      {sceneIO.ui}
    </div>
  )
}
