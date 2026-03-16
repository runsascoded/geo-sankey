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

    // Arrow from input face to node pos
    const inFace: LatLon = [
      n.pos[0] - fLat * layout.approachLen,
      n.pos[1] - fLon * layout.approachLen * ls,
    ]
    const arrowPath = straightLine(inFace, n.pos)
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
    const inFace: LatLon = [n.pos[0] - fLat * layout.approachLen, n.pos[1] - fLon * layout.approachLen * ls]
    const widthPx = pxW(pxPerWeight, layout.throughWeight)
    const minWingFactor = (widthPx + minArrowWingPx * 2) / widthPx
    const effectiveWing = max(arrowWing, minWingFactor)
    arrowPairs.set(nid, arrowEdgePairForPath(
      straightLine(inFace, n.pos),
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

  // --- Full perimeter walk ---
  // Traces the outer boundary of the entire connected flow graph as ONE ring.
  // Forward pass: follows top (left) edges from source to sink.
  // At splits: trace each output branch forward then back.
  // At merges (backward pass): trace side inputs backward then forward.

  const ls = lngScale(refLat)

  function sortedOutputs(nodeId: string): GFlowEdge[] {
    return [...outEdgesOf.get(nodeId)!].sort((a, b) =>
      perpProjection(nodeMap.get(a.to)!.pos, layouts.get(nodeId)!.node.pos, layouts.get(nodeId)!.node.bearing, ls) -
      perpProjection(nodeMap.get(b.to)!.pos, layouts.get(nodeId)!.node.pos, layouts.get(nodeId)!.node.bearing, ls)
    )
  }

  function sortedInputs(nodeId: string): GFlowEdge[] {
    return [...inEdgesOf.get(nodeId)!].sort((a, b) =>
      perpProjection(nodeMap.get(a.from)!.pos, layouts.get(nodeId)!.node.pos, layouts.get(nodeId)!.node.bearing, ls) -
      perpProjection(nodeMap.get(b.from)!.pos, layouts.get(nodeId)!.node.pos, layouts.get(nodeId)!.node.bearing, ls)
    )
  }

  /** Walk forward from a node's output face, tracing left edges forward
   *  to all reachable sinks, then right edges back. Returns a complete
   *  ring segment (may include inner comb for splits). */
  function walkForward(nodeId: string, incomingEdgeId?: string): { left: [number, number][]; right: [number, number][]; tip?: [number, number] } | null {
    const layout = layouts.get(nodeId)!
    const outs = sortedOutputs(nodeId)
    const ins = sortedInputs(nodeId)

    // Prefix: source trunk or body (if this node has a body)
    let prefixLeft: [number, number][] = []
    let prefixRight: [number, number][] = []
    if (layout.isSource) {
      const tp = srcTrunkPairs.get(nodeId)
      if (tp) { prefixLeft = tp.left; prefixRight = tp.right }
    } else if (layout.inWeight > 0 && layout.outWeight > 0) {
      const bp = bodyPairs.get(nodeId)
      if (bp) { prefixLeft = bp.left; prefixRight = bp.right }
    }

    // Sink: arrowhead
    if (layout.isSink) {
      const ap = arrowPairs.get(nodeId)
      if (!ap) return null
      return { left: [...prefixLeft, ...ap.left], right: [...prefixRight, ...ap.right], tip: ap.tip }
    }

    if (outs.length === 0) return null

    // Walk each output branch forward
    const branches: { left: [number, number][]; right: [number, number][]; tip?: [number, number] }[] = []
    for (const outEdge of outs) {
      const ep = edgePairs.get(eid(outEdge))!
      const destResult = walkForward(outEdge.to, eid(outEdge))
      branches.push({
        left: [...ep.left, ...(destResult?.left ?? [])],
        right: [...ep.right, ...(destResult?.right ?? [])],
        tip: destResult?.tip,
      })
    }

    if (branches.length === 1) {
      const b = branches[0]
      const mergeReturn = buildMergeReturn(nodeId, incomingEdgeId)

      if (mergeReturn.length === 0) {
        // No side inputs: simple left/right pair
        return {
          left: [...prefixLeft, ...b.left],
          right: [...prefixRight, ...b.right],
          tip: b.tip,
        }
      }

      // Has merge side-inputs: build complete ring directly.
      // Forward pass: prefixLeft → branch left → tip
      // Backward pass: branch right reversed → mergeReturn → prefixRight reversed
      const ring: [number, number][] = [
        ...prefixLeft,
        ...b.left,
      ]
      if (b.tip) ring.push(b.tip)
      ring.push(...[...b.right].reverse())
      ring.push(...mergeReturn)
      ring.push(...[...prefixRight].reverse())
      ring.push(ring[0])
      return { left: ring, right: [] }
    }

    // Multiple outputs: build ring with comb
    const first = branches[0]
    const last = branches[branches.length - 1]

    const ring: [number, number][] = [
      ...prefixLeft,
      ...first.left,
    ]
    if (first.tip) ring.push(first.tip)
    ring.push(...[...first.right].reverse())

    for (let i = 1; i < branches.length; i++) {
      const bi = branches[i]
      ring.push(...bi.left)
      if (bi.tip) ring.push(bi.tip)
      ring.push(...[...bi.right].reverse())
    }

    // Merge side-inputs
    const mergeRight = buildMergeReturn(nodeId, incomingEdgeId)
    ring.push(...mergeRight)
    ring.push(...[...prefixRight].reverse())
    ring.push(ring[0])

    return { left: ring, right: [] }
  }

  /** When walking backward through a merge node, trace side inputs
   *  (inputs other than the one we arrived from). Each side input is
   *  traced backward to its source then forward again. */
  function buildMergeReturn(nodeId: string, arrivedViaEdge?: string): [number, number][] {
    const ins = sortedInputs(nodeId)
    if (ins.length <= 1) return []

    const pts: [number, number][] = []
    // Walk side inputs from bottom to top (reversed order), skipping the main input
    for (let i = ins.length - 1; i >= 0; i--) {
      const inEdge = ins[i]
      const id = eid(inEdge)
      if (id === arrivedViaEdge) continue

      const ep = edgePairs.get(id)!
      const srcLayout = layouts.get(inEdge.from)!

      // Trace backward along this input: right edge reversed (merge→source direction)
      pts.push(...[...ep.right].reverse())

      // At the source: trace around it
      if (srcLayout.isSource) {
        const tp = srcTrunkPairs.get(inEdge.from)
        if (tp) {
          pts.push(...[...tp.right].reverse())
          pts.push(...tp.left)
        }
      }
      // TODO: handle non-source input nodes (through-nodes feeding into this merge)

      // Trace forward along this input: left edge (source→merge direction)
      pts.push(...ep.left)
    }

    return pts
  }

  // Find THE starting source (pick the one with highest throughput, or first)
  // Walk from it to produce one ring for the entire connected component.
  const features: GeoJSON.Feature[] = []
  const visited = new Set<string>()

  for (const [nid, layout] of layouts) {
    if (!layout.isSource) continue
    if (visited.has(nid)) continue

    // Check if this source's output edges connect to a merge that's reachable
    // from another source (which would make this a side input, not the main entry).
    // For now, start from sources whose first output goes to a node where
    // this source provides the FIRST (topmost) input.
    const outs = sortedOutputs(nid)
    if (outs.length === 0) continue
    const firstDest = outs[0].to
    const destIns = sortedInputs(firstDest)
    const isMainInput = destIns.length === 0 || eid(destIns[0]) === eid(outs[0])

    if (!isMainInput) continue // skip — this source will be traced as a merge side-input

    visited.add(nid)
    const result = walkForward(nid)
    if (result && result.left.length > 0) {
      let ring: [number, number][]
      if (result.right.length === 0) {
        ring = result.left
      } else {
        ring = [...result.left]
        if (result.tip) ring.push(result.tip)
        ring.push(...[...result.right].reverse())
        ring.push(ring[0])
      }
      const w = pxW(pxPerWeight, layout.throughWeight)
      features.push(ringFeature(ring, { color, width: w, key: `sp-${nid}`, opacity: 1 }))
    }
  }

  return { type: 'FeatureCollection', features }
}


