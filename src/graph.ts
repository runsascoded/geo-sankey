import type { LatLon } from './types'
import { lngScale, pxToHalfDeg, pxToDeg } from './geo'
import { directedBezier } from './path'
import { ribbon, ribbonArrow, ribbonEdges, ribbonArrowEdges, ringFeature } from './ribbon'
import type { RibbonArrowOpts } from './ribbon'

const { cos, sin, PI, max } = Math

// --- Public types ---

export interface GFlowNode {
  id: string
  pos: LatLon
  /** Bearing of throughput axis (degrees, 0=N 90=E). Inputs merge from
   *  behind, outputs split ahead. */
  bearing: number
  label?: string
}

export interface GFlowEdge {
  from: string
  to: string
  weight: number
}

export interface FlowGraph {
  nodes: GFlowNode[]
  edges: GFlowEdge[]
}

export interface FlowGraphOpts {
  refLat: number
  zoom: number
  geoScale?: number
  pxPerWeight: number | ((w: number) => number)
  color: string
  arrowWing?: number        // wing width multiplier, default 2.5
  arrowLen?: number         // arrow length multiplier, default 2.0
  minArrowWingPx?: number   // minimum wing width in px beyond trunk edge, default 6
  plugBearingDeg?: number   // bearing convergence for crevice plugging, default 1
  plugFraction?: number     // distance convergence for crevice plugging, default 0.3
}

// --- Internal types ---

interface Slot {
  pos: LatLon
  halfW: number
  bearing: number
}

interface NodeLayout {
  node: GFlowNode
  inSlots: Map<string, Slot>
  outSlots: Map<string, Slot>
  inWeight: number
  outWeight: number
  throughWeight: number
  halfW: number
  approachLen: number
  isSink: boolean
  isSource: boolean
}

// --- Helpers ---

function fwd(bearing: number): [number, number] {
  const rad = bearing * PI / 180
  return [cos(rad), sin(rad)]
}

function perpL(bearing: number): [number, number] {
  const rad = bearing * PI / 180
  return [sin(rad), -cos(rad)]
}

function pxW(pxPerWeight: number | ((w: number) => number), weight: number): number {
  return typeof pxPerWeight === 'number' ? weight * pxPerWeight : pxPerWeight(weight)
}

function eid(e: GFlowEdge): string {
  return `${e.from}→${e.to}`
}

function straightLine(start: LatLon, end: LatLon, n = 5): LatLon[] {
  const pts: LatLon[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    pts.push([start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t])
  }
  return pts
}

// --- Slot computation ---

/** Project a position onto the perpendicular axis of a bearing at a reference point.
 *  Returns a signed scalar: positive = perpLeft side, negative = perpRight side. */
function perpProjection(pos: LatLon, ref: LatLon, bearing: number, ls: number): number {
  const [pLat, pLon] = perpL(bearing)
  const dLat = pos[0] - ref[0]
  const dLon = (pos[1] - ref[1]) * ls
  return dLat * pLat + dLon * pLon  // note: pLon already has its sign
}

function computeLayout(graph: FlowGraph, opts: FlowGraphOpts): Map<string, NodeLayout> {
  const { refLat, zoom, geoScale = 1, pxPerWeight } = opts
  const nodeMap = new Map(graph.nodes.map(n => [n.id, n]))
  const layouts = new Map<string, NodeLayout>()

  const outEdgesOf = new Map<string, GFlowEdge[]>()
  const inEdgesOf = new Map<string, GFlowEdge[]>()
  for (const n of graph.nodes) {
    outEdgesOf.set(n.id, [])
    inEdgesOf.set(n.id, [])
  }
  for (const e of graph.edges) {
    outEdgesOf.get(e.from)!.push(e)
    inEdgesOf.get(e.to)!.push(e)
  }

  const ls = lngScale(refLat)

  // Auto-compute bearing for leaf nodes from edge direction
  for (const n of graph.nodes) {
    const inEs = inEdgesOf.get(n.id)!
    const outEs = outEdgesOf.get(n.id)!
    if (inEs.length > 0 && outEs.length === 0 && inEs.length === 1) {
      // Sink with single input: bearing = direction FROM source TO this node
      const src = nodeMap.get(inEs[0].from)!
      const dLat = n.pos[0] - src.pos[0]
      const dLon = (n.pos[1] - src.pos[1]) * lngScale(refLat)
      n.bearing = Math.atan2(dLon, dLat) * 180 / PI
    }
    if (outEs.length > 0 && inEs.length === 0 && outEs.length === 1) {
      // Source with single output: bearing = direction FROM this node TO dest
      const dst = nodeMap.get(outEs[0].to)!
      const dLat = dst.pos[0] - n.pos[0]
      const dLon = (dst.pos[1] - n.pos[1]) * lngScale(refLat)
      n.bearing = Math.atan2(dLon, dLat) * 180 / PI
    }
  }

  for (const n of graph.nodes) {
    const inW = inEdgesOf.get(n.id)!.reduce((s, e) => s + e.weight, 0)
    const outW = outEdgesOf.get(n.id)!.reduce((s, e) => s + e.weight, 0)
    const throughW = max(inW, outW)
    const halfW = pxToHalfDeg(pxW(pxPerWeight, throughW), zoom, geoScale, refLat)
    layouts.set(n.id, {
      node: n,
      inSlots: new Map(),
      outSlots: new Map(),
      inWeight: inW,
      outWeight: outW,
      throughWeight: throughW,
      halfW,
      approachLen: halfW * 1.5,
      isSink: outEdgesOf.get(n.id)!.length === 0 && inW > 0,
      isSource: inEdgesOf.get(n.id)!.length === 0 && outW > 0,
    })
  }

  // Compute slots for each node
  for (const n of graph.nodes) {
    const layout = layouts.get(n.id)!
    const [fLat, fLon] = fwd(n.bearing)
    const [pLat, pLon] = perpL(n.bearing)

    // Input slots
    const inEdges = inEdgesOf.get(n.id)!
    // Sort by perpendicular projection of source position (most-negative first)
    inEdges.sort((a, b) =>
      perpProjection(nodeMap.get(a.from)!.pos, n.pos, n.bearing, ls) -
      perpProjection(nodeMap.get(b.from)!.pos, n.pos, n.bearing, ls)
    )
    const inTotalPx = inEdges.reduce((s, e) => s + pxW(pxPerWeight, e.weight), 0)
    let inCum = 0
    for (const e of inEdges) {
      const ePx = pxW(pxPerWeight, e.weight)
      const centerOffset = -inTotalPx / 2 + inCum + ePx / 2
      inCum += ePx
      const offsetDeg = pxToDeg(centerOffset, zoom, geoScale, refLat)
      layout.inSlots.set(eid(e), {
        pos: [
          n.pos[0] - fLat * layout.approachLen + pLat * offsetDeg,
          n.pos[1] - fLon * layout.approachLen * ls + pLon * offsetDeg * ls,
        ],
        halfW: pxToHalfDeg(ePx, zoom, geoScale, refLat),
        bearing: n.bearing,
      })
    }

    // Output slots
    const outEdges = outEdgesOf.get(n.id)!
    outEdges.sort((a, b) =>
      perpProjection(nodeMap.get(a.to)!.pos, n.pos, n.bearing, ls) -
      perpProjection(nodeMap.get(b.to)!.pos, n.pos, n.bearing, ls)
    )
    const outTotalPx = outEdges.reduce((s, e) => s + pxW(pxPerWeight, e.weight), 0)
    let outCum = 0
    for (const e of outEdges) {
      const ePx = pxW(pxPerWeight, e.weight)
      const centerOffset = -outTotalPx / 2 + outCum + ePx / 2
      outCum += ePx
      const offsetDeg = pxToDeg(centerOffset, zoom, geoScale, refLat)
      layout.outSlots.set(eid(e), {
        pos: [
          n.pos[0] + fLat * layout.approachLen + pLat * offsetDeg,
          n.pos[1] + fLon * layout.approachLen * ls + pLon * offsetDeg * ls,
        ],
        halfW: pxToHalfDeg(ePx, zoom, geoScale, refLat),
        bearing: n.bearing,
      })
    }
  }

  return layouts
}

// --- Main render ---

export function renderFlowGraph(
  graph: FlowGraph,
  opts: FlowGraphOpts,
): GeoJSON.FeatureCollection {
  const {
    refLat, zoom, geoScale = 1, pxPerWeight, color,
    arrowWing = 2.5, arrowLen = 2.0, minArrowWingPx = 6,
  } = opts
  const layouts = computeLayout(graph, opts)
  const features: GeoJSON.Feature[] = []

  // 1. Render each edge as a bezier ribbon
  for (const edge of graph.edges) {
    const id = eid(edge)
    const srcLayout = layouts.get(edge.from)!
    const dstLayout = layouts.get(edge.to)!
    const srcSlot = srcLayout.outSlots.get(id)!
    const dstSlot = dstLayout.inSlots.get(id)!
    const ePx = pxW(pxPerWeight, edge.weight)
    const halfW = pxToHalfDeg(ePx, zoom, geoScale, refLat)

    const path = directedBezier(srcSlot.pos, dstSlot.pos, srcSlot.bearing, dstSlot.bearing)
    const ring = ribbon(path, halfW, refLat)
    if (ring.length) {
      features.push(ringFeature(ring, { color, width: ePx, key: id, opacity: 1 }))
    }
  }

  // 2. Render node bodies (through-nodes with both inputs and outputs)
  for (const [, layout] of layouts) {
    if (layout.inWeight === 0 || layout.outWeight === 0) continue
    const n = layout.node
    const ls = lngScale(refLat)
    const [fLat, fLon] = fwd(n.bearing)

    const inFace: LatLon = [
      n.pos[0] - fLat * layout.approachLen,
      n.pos[1] - fLon * layout.approachLen * ls,
    ]
    const outFace: LatLon = [
      n.pos[0] + fLat * layout.approachLen,
      n.pos[1] + fLon * layout.approachLen * ls,
    ]
    const bodyPath = straightLine(inFace, outFace)
    const bodyRing = ribbon(bodyPath, layout.halfW, refLat)
    if (bodyRing.length) {
      features.push(ringFeature(bodyRing, {
        color, width: pxW(pxPerWeight, layout.throughWeight), key: n.id, opacity: 1,
      }))
    }
  }

  // 3. Render sink arrowheads
  for (const [, layout] of layouts) {
    if (!layout.isSink) continue
    const n = layout.node
    const ls = lngScale(refLat)
    const [fLat, fLon] = fwd(n.bearing)

    // Arrow path needs to be long enough that ribbonArrow's 40% clamp
    // doesn't squish the arrowhead. Start far behind the node.
    const arrowStart: LatLon = [
      n.pos[0] - fLat * layout.halfW * 10,
      n.pos[1] - fLon * layout.halfW * 10 * ls,
    ]
    const arrowPath = straightLine(arrowStart, n.pos, 10)
    const widthPx = pxW(pxPerWeight, layout.throughWeight)
    // Ensure minimum wing extension beyond trunk edge
    const minWingFactor = (widthPx + minArrowWingPx * 2) / widthPx
    const effectiveWing = max(arrowWing, minWingFactor)
    const arrowOpts: RibbonArrowOpts = {
      arrowWingFactor: effectiveWing,
      arrowLenFactor: arrowLen,
      widthPx,
    }
    const arrowRing = ribbonArrow(arrowPath, layout.halfW, refLat, arrowOpts)
    if (arrowRing.length) {
      features.push(ringFeature(arrowRing, {
        color, width: widthPx, key: `${n.id}-arrow`, opacity: 1,
      }))
    }
  }

  // 4. Render source trunks (nodes with only outputs, no inputs)
  for (const [, layout] of layouts) {
    if (!layout.isSource) continue
    const n = layout.node
    const ls = lngScale(refLat)
    const [fLat, fLon] = fwd(n.bearing)

    const outFace: LatLon = [
      n.pos[0] + fLat * layout.approachLen,
      n.pos[1] + fLon * layout.approachLen * ls,
    ]
    const trunkPath = straightLine(n.pos, outFace)
    const trunkRing = ribbon(trunkPath, layout.halfW, refLat)
    if (trunkRing.length) {
      features.push(ringFeature(trunkRing, {
        color, width: pxW(pxPerWeight, layout.outWeight), key: `${n.id}-trunk`, opacity: 1,
      }))
    }
  }

  features.sort((a, b) => ((b.properties?.width as number) ?? 0) - ((a.properties?.width as number) ?? 0))
  return { type: 'FeatureCollection', features }
}

// --- Single-poly: compute edges for each shape, then stitch ---

interface EdgePair {
  left: [number, number][]
  right: [number, number][]
  tip?: [number, number]
}

function edgePairForPath(path: LatLon[], halfW: number, refLat: number): EdgePair {
  const e = ribbonEdges(path, halfW, refLat)
  return { left: e.left, right: e.right }
}

function arrowEdgePairForPath(path: LatLon[], halfW: number, refLat: number, arrowOpts: RibbonArrowOpts): EdgePair {
  const e = ribbonArrowEdges(path, halfW, refLat, arrowOpts)
  return { left: e.left, right: e.right, tip: e.tip }
}

/** Render a flow graph as a single polygon per connected component. */
export function renderFlowGraphSinglePoly(
  graph: FlowGraph,
  opts: FlowGraphOpts,
): GeoJSON.FeatureCollection {
  const {
    refLat, zoom, geoScale = 1, pxPerWeight, color,
    arrowWing = 2.5, arrowLen = 2.0, minArrowWingPx = 6,
    plugBearingDeg = 1, plugFraction = 0.3,
  } = opts
  const layouts = computeLayout(graph, opts)
  const nodeMap = new Map(graph.nodes.map(n => [n.id, n]))

  const outEdgesOf = new Map<string, GFlowEdge[]>()
  const inEdgesOf = new Map<string, GFlowEdge[]>()
  for (const n of graph.nodes) {
    outEdgesOf.set(n.id, [])
    inEdgesOf.set(n.id, [])
  }
  for (const e of graph.edges) {
    outEdgesOf.get(e.from)!.push(e)
    inEdgesOf.get(e.to)!.push(e)
  }

  // Compute edge pairs for every edge
  const edgePairs = new Map<string, EdgePair>()
  for (const edge of graph.edges) {
    const id = eid(edge)
    const srcLayout = layouts.get(edge.from)!
    const dstLayout = layouts.get(edge.to)!
    const srcSlot = srcLayout.outSlots.get(id)!
    const dstSlot = dstLayout.inSlots.get(id)!
    const ePx = pxW(pxPerWeight, edge.weight)
    const halfW = pxToHalfDeg(ePx, zoom, geoScale, refLat)
    const path = directedBezier(srcSlot.pos, dstSlot.pos, srcSlot.bearing, dstSlot.bearing)
    edgePairs.set(id, edgePairForPath(path, halfW, refLat))
  }

  // Compute body edge pairs for each through-node
  const bodyPairs = new Map<string, EdgePair>()
  for (const [nid, layout] of layouts) {
    if (layout.inWeight === 0 || layout.outWeight === 0) continue
    const n = layout.node
    const ls = lngScale(refLat)
    const [fLat, fLon] = fwd(n.bearing)
    const inFace: LatLon = [n.pos[0] - fLat * layout.approachLen, n.pos[1] - fLon * layout.approachLen * ls]
    const outFace: LatLon = [n.pos[0] + fLat * layout.approachLen, n.pos[1] + fLon * layout.approachLen * ls]
    bodyPairs.set(nid, edgePairForPath(straightLine(inFace, outFace), layout.halfW, refLat))
  }

  // Compute arrowhead edge pairs for sinks
  const arrowPairs = new Map<string, EdgePair>()
  for (const [nid, layout] of layouts) {
    if (!layout.isSink) continue
    const n = layout.node
    const ls = lngScale(refLat)
    const [fLat, fLon] = fwd(n.bearing)
    const arrowStart: LatLon = [n.pos[0] - fLat * layout.halfW * 10, n.pos[1] - fLon * layout.halfW * 10 * ls]
    const widthPx = pxW(pxPerWeight, layout.throughWeight)
    const minWingFactor = (widthPx + minArrowWingPx * 2) / widthPx
    const effectiveWing = max(arrowWing, minWingFactor)
    arrowPairs.set(nid, arrowEdgePairForPath(
      straightLine(arrowStart, n.pos, 10),
      layout.halfW, refLat,
      { arrowWingFactor: effectiveWing, arrowLenFactor: arrowLen, widthPx },
    ))
  }

  // Source trunk edge pairs
  const srcTrunkPairs = new Map<string, EdgePair>()
  for (const [nid, layout] of layouts) {
    if (!layout.isSource) continue
    const n = layout.node
    const ls = lngScale(refLat)
    const [fLat, fLon] = fwd(n.bearing)
    const outFace: LatLon = [n.pos[0] + fLat * layout.approachLen, n.pos[1] + fLon * layout.approachLen * ls]
    srcTrunkPairs.set(nid, edgePairForPath(straightLine(n.pos, outFace), layout.halfW, refLat))
  }

  // --- Iterative perimeter walk ---
  // Direct iterative perimeter walk. Appends points to the ring as we
  // trace the outer boundary of the entire connected flow.
  const ls = lngScale(refLat)

  function sortedOuts(nodeId: string): GFlowEdge[] {
    return [...outEdgesOf.get(nodeId)!].sort((a, b) =>
      perpProjection(nodeMap.get(a.to)!.pos, layouts.get(nodeId)!.node.pos, layouts.get(nodeId)!.node.bearing, ls) -
      perpProjection(nodeMap.get(b.to)!.pos, layouts.get(nodeId)!.node.pos, layouts.get(nodeId)!.node.bearing, ls)
    )
  }

  function sortedIns(nodeId: string): GFlowEdge[] {
    return [...inEdgesOf.get(nodeId)!].sort((a, b) =>
      perpProjection(nodeMap.get(a.from)!.pos, layouts.get(nodeId)!.node.pos, layouts.get(nodeId)!.node.bearing, ls) -
      perpProjection(nodeMap.get(b.from)!.pos, layouts.get(nodeId)!.node.pos, layouts.get(nodeId)!.node.bearing, ls)
    )
  }

  /** Recursively trace a branch: forward along left edges to sink,
   *  then backward along right edges. Appends directly to `ring`. */
  function traceBranch(nodeId: string, arrivedViaEdge: string | null, ring: [number, number][]) {
    const layout = layouts.get(nodeId)!

    // --- Forward: left edges of this node's prefix ---
    // Only source trunks need a prefix. Through-node bodies are implicit
    // in the gap between input edge endpoints and output edge startpoints.
    if (layout.isSource) {
      const tp = srcTrunkPairs.get(nodeId)
      if (tp) ring.push(...tp.left)
    }

    const outs = sortedOuts(nodeId)

    // --- Sink: arrowhead from input face to node pos ---
    if (layout.isSink) {
      const n = layout.node
      const nodeLs = lngScale(refLat)
      const [fLat, fLon] = fwd(n.bearing)
      const inFace: LatLon = [
        n.pos[0] - fLat * layout.approachLen,
        n.pos[1] - fLon * layout.approachLen * nodeLs,
      ]
      const widthPx = pxW(pxPerWeight, layout.throughWeight)
      const minWingFactor = (widthPx + minArrowWingPx * 2) / widthPx
      const effectiveWing = max(arrowWing, minWingFactor)
      const ap = arrowEdgePairForPath(
        straightLine(inFace, n.pos, 10),
        layout.halfW, refLat,
        { arrowWingFactor: effectiveWing, arrowLenFactor: arrowLen, widthPx },
      )
      ring.push(...ap.left)
      if (ap.tip) ring.push(ap.tip)
      ring.push(...[...ap.right].reverse())
      return
    }

    // --- Forward: trace each output branch ---
    for (let i = 0; i < outs.length; i++) {
      const outEdge = outs[i]
      const ep = edgePairs.get(eid(outEdge))!

      // Forward along this edge's left
      ring.push(...ep.left)

      // Recurse into destination
      traceBranch(outEdge.to, eid(outEdge), ring)

      // Backward along this edge's right
      ring.push(...[...ep.right].reverse())
    }

    // --- Backward: merge side-inputs ---
    // After tracing all outputs and coming back, trace side inputs
    // (inputs other than the one we arrived from).
    const ins = sortedIns(nodeId)
    if (ins.length > 1 && arrivedViaEdge) {
      // Walk side inputs from bottom to top (reversed order)
      for (let i = ins.length - 1; i >= 0; i--) {
        const inEdge = ins[i]
        if (eid(inEdge) === arrivedViaEdge) continue

        const ep = edgePairs.get(eid(inEdge))!

        // Backward along this input's right edge (merge→source)
        ring.push(...[...ep.right].reverse())

        // Trace around the source node
        const srcLayout = layouts.get(inEdge.from)!
        if (srcLayout.isSource) {
          const tp = srcTrunkPairs.get(inEdge.from)
          if (tp) {
            ring.push(...[...tp.right].reverse())
            ring.push(...tp.left)
          }
        }
        // TODO: handle non-source input nodes

        // Forward along this input's left edge (source→merge)
        ring.push(...ep.left)
      }
    }

    if (layout.isSource) {
      const tp = srcTrunkPairs.get(nodeId)
      if (tp) ring.push(...[...tp.right].reverse())
    }
  }

  // Find the main source (the one that feeds into the first/top input of its destination)
  const features: GeoJSON.Feature[] = []
  for (const [nid, layout] of layouts) {
    if (!layout.isSource) continue
    const outs = sortedOuts(nid)
    if (outs.length === 0) continue
    const destIns = sortedIns(outs[0].to)
    if (destIns.length > 0 && eid(destIns[0]) !== eid(outs[0])) continue

    const ring: [number, number][] = []
    traceBranch(nid, null, ring)
    if (ring.length > 0) {
      ring.push(ring[0])
      const w = pxW(pxPerWeight, layout.throughWeight)
      features.push(ringFeature(ring, { color, width: w, key: `sp-${nid}`, opacity: 1 }))
    }
  }

  return { type: 'FeatureCollection', features }
}


