import type { LatLon } from './types'
import { lngScale, pxToHalfDeg, pxToDeg } from './geo'
import { directedBezier, perpAt } from './path'
import { ribbon, ribbonArrow, ribbonEdges, ribbonArrowEdges, ringFeature } from './ribbon'
import type { RibbonArrowOpts } from './ribbon'

const { cos, sin, PI, max } = Math


// --- Public types ---

export interface GFlowNode {
  id: string
  pos: LatLon
  /** Bearing of throughput axis (degrees, 0=N 90=E). Inputs merge from
   *  behind, outputs split ahead. Optional — auto-derived for nodes with
   *  a single output or sinks with a single input; defaults to 90. */
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
  arrowWing?: number        // wing width multiplier, default 1.6
  arrowLen?: number         // arrow length multiplier, default 1.3
  minArrowWingPx?: number   // minimum wing extension in px beyond trunk edge, default 0
  plugBearingDeg?: number   // bearing convergence for crevice plugging, default 1
  plugFraction?: number     // distance convergence for crevice plugging, default 0.3
  bezierN?: number          // bezier sample count per edge (default 20, 1=straight)
  nodeApproach?: number     // through-node approach zone as multiple of halfW (default 0.5)
  creaseSkip?: number       // points to skip at merge/split crease (default 1)
}

/** Remove redundant points from a ring using perpendicular distance.
 *  A point is redundant if it's within `eps` degrees of the line between
 *  its neighbors (Douglas-Peucker style, single pass). */
function simplifyRing(ring: [number, number][], eps = 0.000001): [number, number][] {
  if (ring.length < 3) return ring
  const out: [number, number][] = [ring[0]]
  for (let i = 1; i < ring.length - 1; i++) {
    const [ax, ay] = ring[i - 1], [bx, by] = ring[i], [cx, cy] = ring[i + 1]
    // Perpendicular distance from B to line A→C
    const dx = cx - ax, dy = cy - ay
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len === 0) continue
    const dist = Math.abs((bx - ax) * dy - (by - ay) * dx) / len
    if (dist > eps) out.push(ring[i])
  }
  out.push(ring[ring.length - 1])
  return out
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
  // Face corners in [lon, lat] format (for perimeter walk)
  inFaceLeft: [number, number]
  inFaceRight: [number, number]
  outFaceLeft: [number, number]
  outFaceRight: [number, number]
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

/** Compute LEFT and RIGHT offset curves for an edge bezier.
 *  Uses node bearing perpendicular at endpoints (not bezier tangent)
 *  to ensure alignment at node boundaries. Interior points use perpAt. */
function offsetCurve(
  path: LatLon[], halfW: number, refLat: number,
): { left: [number, number][]; right: [number, number][] } {
  const n = path.length
  if (n < 2) return { left: [], right: [] }
  const ls = lngScale(refLat)
  const left: [number, number][] = []
  const right: [number, number][] = []

  // Compute per-segment perpendiculars in Mercator screen space
  const segPerps: { pLon: number; pLat: number }[] = []
  for (let i = 0; i < n - 1; i++) {
    const dy = (path[i + 1][0] - path[i][0]) * ls
    const dx = path[i + 1][1] - path[i][1]
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len > 0) {
      segPerps.push({ pLon: -dy / len, pLat: dx / len })
    } else {
      segPerps.push({ pLon: 0, pLat: 0 })
    }
  }

  // Miter join: at each vertex, compute the offset that makes adjacent
  // segments' left/right edges exactly parallel to their center segments.
  for (let i = 0; i < n; i++) {
    let pLon: number, pLat: number

    if (i === 0) {
      pLon = segPerps[0].pLon; pLat = segPerps[0].pLat
    } else if (i === n - 1) {
      pLon = segPerps[n - 2].pLon; pLat = segPerps[n - 2].pLat
    } else {
      // Interior: miter join between segments i-1 and i
      const n1 = segPerps[i - 1], n2 = segPerps[i]
      // Miter direction = average of the two perpendiculars, normalized
      const mLon = n1.pLon + n2.pLon, mLat = n1.pLat + n2.pLat
      const mLen = Math.sqrt(mLon * mLon + mLat * mLat)
      if (mLen > 0.001) {
        const mLonN = mLon / mLen, mLatN = mLat / mLen
        // Miter scale = 1 / dot(miter_dir, segment_perp)
        const dot = mLonN * n1.pLon + mLatN * n1.pLat
        const scale = Math.min(1 / Math.max(dot, 0.01), 2) // miter, capped at 2x to prevent spikes
        pLon = mLonN * scale; pLat = mLatN * scale
      } else {
        pLon = n1.pLon; pLat = n1.pLat
      }
    }

    // Apply offset: pLon is screen-x (lon degrees), pLat is screen-y,
    // convert back to lat by dividing by ls
    left.push([path[i][1] + pLon * halfW, path[i][0] + pLat * halfW / ls])
    right.push([path[i][1] - pLon * halfW, path[i][0] - pLat * halfW / ls])
  }

  return { left, right }
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

function computeLayout(graph: FlowGraph, opts: FlowGraphOpts, alignThroughWidth = false): Map<string, NodeLayout> {
  const { refLat, zoom, geoScale = 1, pxPerWeight, arrowLen = 1.3, nodeApproach = 0.5 } = opts
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

  // Auto-compute bearing from edge directions.
  // Single output → toward dest. Sink with single input → from source.
  // Fallback to 90° (east) if no edges and no declared bearing.
  for (const n of graph.nodes) {
    const inEs = inEdgesOf.get(n.id)!
    const outEs = outEdgesOf.get(n.id)!
    if (outEs.length === 1) {
      const dst = nodeMap.get(outEs[0].to)!
      const dLat = dst.pos[0] - n.pos[0]
      const dLon = (dst.pos[1] - n.pos[1]) * lngScale(refLat)
      n.bearing = Math.atan2(dLon, dLat) * 180 / PI
    } else if (outEs.length === 0 && inEs.length === 1) {
      const src = nodeMap.get(inEs[0].from)!
      const dLat = n.pos[0] - src.pos[0]
      const dLon = (n.pos[1] - src.pos[1]) * lngScale(refLat)
      n.bearing = Math.atan2(dLon, dLat) * 180 / PI
    }
  }

  for (const n of graph.nodes) {
    const inW = inEdgesOf.get(n.id)!.reduce((s, e) => s + e.weight, 0)
    const outW = outEdgesOf.get(n.id)!.reduce((s, e) => s + e.weight, 0)
    const throughW = max(inW, outW)
    const halfW = pxToHalfDeg(pxW(pxPerWeight, throughW), zoom, geoScale, refLat)
    // Face corners: perpRibbon = [-sin(B), cos(B)] for ribbon convention
    const bRad = n.bearing * PI / 180
    // Screen-space directions for bearing B:
    // Forward: dLon = sin(B)*d, dLat = cos(B)*d/ls
    // Perp left: dLon = -cos(B)*d, dLat = sin(B)*d/ls
    const fwdLon = sin(bRad), fwdLat = cos(bRad) / ls
    const perpLon = -cos(bRad), perpLat = sin(bRad) / ls
    const isSink = outEdgesOf.get(n.id)!.length === 0 && inW > 0
    const ap = isSink
      ? halfW * nodeApproach + halfW * 2 * arrowLen
      : halfW * nodeApproach
    layouts.set(n.id, {
      node: n,
      inSlots: new Map(),
      outSlots: new Map(),
      inWeight: inW,
      outWeight: outW,
      throughWeight: throughW,
      halfW,
      approachLen: ap,
      isSink,
      isSource: inEdgesOf.get(n.id)!.length === 0 && outW > 0,
      // Face corners [lon, lat] — screen-space perpendicular to bearing
      inFaceLeft:   [n.pos[1] - fwdLon * ap + perpLon * halfW, n.pos[0] - fwdLat * ap + perpLat * halfW],
      inFaceRight:  [n.pos[1] - fwdLon * ap - perpLon * halfW, n.pos[0] - fwdLat * ap - perpLat * halfW],
      outFaceLeft:  [n.pos[1] + fwdLon * ap + perpLon * halfW, n.pos[0] + fwdLat * ap + perpLat * halfW],
      outFaceRight: [n.pos[1] + fwdLon * ap - perpLon * halfW, n.pos[0] + fwdLat * ap - perpLat * halfW],
    })
  }

  // Second pass: clamp approaches per-edge to prevent overlap.
  // For each edge, if src.approach + dst.approach > edge distance,
  // reduce both proportionally.
  for (const e of graph.edges) {
    const srcL = layouts.get(e.from)!
    const dstL = layouts.get(e.to)!
    const dLat = dstL.node.pos[0] - srcL.node.pos[0]
    const dLon = (dstL.node.pos[1] - srcL.node.pos[1]) * ls
    const dist = Math.sqrt(dLat * dLat + dLon * dLon)
    const totalApproach = srcL.approachLen + dstL.approachLen
    // Clamp when approaches consume more than 70% of the distance,
    // leaving at least 30% for the edge bezier.
    if (totalApproach > dist * 0.5 && dist > 0) {
      const available = dist * 0.5
      const srcShare = srcL.approachLen / totalApproach
      srcL.approachLen = max(srcL.halfW * 0.3, available * srcShare)
      dstL.approachLen = max(dstL.halfW * 0.3, available * (1 - srcShare))
    }
  }

  // Compute slots for each node
  for (const n of graph.nodes) {
    const layout = layouts.get(n.id)!
    const bRad = n.bearing * PI / 180
    // Screen-space forward/perp (consistent with face corners)
    const sFwdLon = sin(bRad), sFwdLat = cos(bRad) / ls
    const sPerpLon = -cos(bRad), sPerpLat = sin(bRad) / ls

    // Input slots
    const inEdges = inEdgesOf.get(n.id)!
    inEdges.sort((a, b) =>
      perpProjection(nodeMap.get(a.from)!.pos, n.pos, n.bearing, ls) -
      perpProjection(nodeMap.get(b.from)!.pos, n.pos, n.bearing, ls)
    )
    const throughPx = pxW(pxPerWeight, layout.throughWeight)
    const inTotalPx = inEdges.reduce((s, e) => s + pxW(pxPerWeight, e.weight), 0)
    const inBasePx = alignThroughWidth ? throughPx : inTotalPx
    let inCum = 0
    for (const e of inEdges) {
      const ePx = pxW(pxPerWeight, e.weight)
      const centerOffset = -inBasePx / 2 + inCum + ePx / 2
      inCum += ePx
      const offsetDeg = pxToDeg(centerOffset, zoom, geoScale, refLat)
      layout.inSlots.set(eid(e), {
        pos: [
          n.pos[0] - sFwdLat * layout.approachLen + sPerpLat * offsetDeg,
          n.pos[1] - sFwdLon * layout.approachLen + sPerpLon * offsetDeg,
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
    const outBasePx = alignThroughWidth ? throughPx : outTotalPx
    let outCum = 0
    for (const e of outEdges) {
      const ePx = pxW(pxPerWeight, e.weight)
      const centerOffset = -outBasePx / 2 + outCum + ePx / 2
      outCum += ePx
      const offsetDeg = pxToDeg(centerOffset, zoom, geoScale, refLat)
      layout.outSlots.set(eid(e), {
        pos: [
          n.pos[0] + sFwdLat * layout.approachLen + sPerpLat * offsetDeg,
          n.pos[1] + sFwdLon * layout.approachLen + sPerpLon * offsetDeg,
        ],
        halfW: pxToHalfDeg(ePx, zoom, geoScale, refLat),
        bearing: n.bearing,
      })
    }
  }

  return layouts
}

/** Return debug geometry: edge center-line beziers and approach rectangles. */
export function renderFlowGraphDebug(
  graph: FlowGraph,
  opts: FlowGraphOpts,
): GeoJSON.FeatureCollection {
  const { bezierN = 20 } = opts
  const layouts = computeLayout(graph, opts, true)
  const features: GeoJSON.Feature[] = []
  const debugLs = lngScale(opts.refLat)

  // Edge center-line beziers
  for (const edge of graph.edges) {
    const id = eid(edge)
    const srcLayout = layouts.get(edge.from)!
    const dstLayout = layouts.get(edge.to)!
    const srcSlot = srcLayout.outSlots.get(id)!
    const dstSlot = dstLayout.inSlots.get(id)!
    const path = directedBezier(srcSlot.pos, dstSlot.pos, srcSlot.bearing, dstSlot.bearing, bezierN, debugLs)
    features.push({
      type: 'Feature',
      properties: { kind: 'bezier', edge: id, weight: edge.weight },
      geometry: {
        type: 'LineString',
        coordinates: path.map(p => [p[1], p[0]]),
      },
    })
    // Bezier sample points
    for (let i = 0; i < path.length; i++) {
      features.push({
        type: 'Feature',
        properties: { kind: 'bezier-pt', edge: id, idx: i },
        geometry: { type: 'Point', coordinates: [path[i][1], path[i][0]] },
      })
    }
  }

  const { arrowWing = 1.6, arrowLen = 1.3, nodeApproach = 0.5 } = opts

  // Approach rectangles for through-nodes
  for (const [, layout] of layouts) {
    if (layout.inWeight === 0 || layout.outWeight === 0) continue
    features.push({
      type: 'Feature',
      properties: { kind: 'approach', node: layout.node.id },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          layout.inFaceLeft, layout.outFaceLeft,
          layout.outFaceRight, layout.inFaceRight,
          layout.inFaceLeft, // close
        ]],
      },
    })
  }

  // Sink arrowhead polygons (stem rectangle + triangle)
  for (const [, layout] of layouts) {
    if (!layout.isSink) continue
    const n = layout.node
    const bRad = n.bearing * PI / 180
    // Screen-space directions (same as traceBranch uses)
    const sFwd: [number, number] = [sin(bRad), cos(bRad) / debugLs]
    const sPerp: [number, number] = [-cos(bRad), sin(bRad) / debugLs]
    const arrowH = layout.halfW * 2 * arrowLen
    const hw = layout.halfW
    const wingW = hw * arrowWing
    // Input face (where bezier ends)
    const ifLon = n.pos[1] - sFwd[0] * layout.approachLen
    const ifLat = n.pos[0] - sFwd[1] * layout.approachLen
    // Arrow base (where stem meets triangle)
    const abLon = n.pos[1] - sFwd[0] * arrowH
    const abLat = n.pos[0] - sFwd[1] * arrowH
    const ifL: [number, number] = [ifLon + sPerp[0] * hw, ifLat + sPerp[1] * hw]
    const ifR: [number, number] = [ifLon - sPerp[0] * hw, ifLat - sPerp[1] * hw]
    const abL: [number, number] = [abLon + sPerp[0] * hw, abLat + sPerp[1] * hw]
    const abR: [number, number] = [abLon - sPerp[0] * hw, abLat - sPerp[1] * hw]
    const wL: [number, number] = [abLon + sPerp[0] * wingW, abLat + sPerp[1] * wingW]
    const wR: [number, number] = [abLon - sPerp[0] * wingW, abLat - sPerp[1] * wingW]
    const tip: [number, number] = [n.pos[1], n.pos[0]]
    features.push({
      type: 'Feature',
      properties: { kind: 'arrowhead', node: n.id },
      geometry: {
        type: 'Polygon',
        coordinates: [[ifL, abL, wL, tip, wR, abR, ifR, ifL]],
      },
    })
  }

  return { type: 'FeatureCollection', features }
}

// --- Main render ---

export function renderFlowGraph(
  graph: FlowGraph,
  opts: FlowGraphOpts,
): GeoJSON.FeatureCollection {
  const {
    refLat, zoom, geoScale = 1, pxPerWeight, color,
    arrowWing = 1.6, arrowLen = 1.3, minArrowWingPx = 0,
    bezierN = 20,
  } = opts
  const layouts = computeLayout(graph, opts)
  const features: GeoJSON.Feature[] = []
  const renderLs = lngScale(refLat)

  // 1. Render each edge as a bezier ribbon
  for (const edge of graph.edges) {
    const id = eid(edge)
    const srcLayout = layouts.get(edge.from)!
    const dstLayout = layouts.get(edge.to)!
    const srcSlot = srcLayout.outSlots.get(id)!
    const dstSlot = dstLayout.inSlots.get(id)!
    const ePx = pxW(pxPerWeight, edge.weight)
    const halfW = pxToHalfDeg(ePx, zoom, geoScale, refLat)

    const path = directedBezier(srcSlot.pos, dstSlot.pos, srcSlot.bearing, dstSlot.bearing, bezierN, renderLs)
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
    arrowWing = 1.6, arrowLen = 1.3, minArrowWingPx = 0,
    plugBearingDeg = 1, plugFraction = 0.3, creaseSkip = 1,
    bezierN = 20,
  } = opts
  const layouts = computeLayout(graph, opts, true) // align slots to through-width
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
  const spLs = lngScale(refLat)
  const edgePairs = new Map<string, EdgePair>()
  for (const edge of graph.edges) {
    const id = eid(edge)
    const srcLayout = layouts.get(edge.from)!
    const dstLayout = layouts.get(edge.to)!
    const srcSlot = srcLayout.outSlots.get(id)!
    const dstSlot = dstLayout.inSlots.get(id)!
    const ePx = pxW(pxPerWeight, edge.weight)
    const halfW = pxToHalfDeg(ePx, zoom, geoScale, refLat)
    const path = directedBezier(srcSlot.pos, dstSlot.pos, srcSlot.bearing, dstSlot.bearing, bezierN, spLs)
    edgePairs.set(id, offsetCurve(path, halfW, refLat))
  }

  // Body pairs: use precomputed face corners from layout
  const bodyPairs = new Map<string, EdgePair>()
  for (const [nid, layout] of layouts) {
    if (layout.inWeight === 0 || layout.outWeight === 0) continue
    bodyPairs.set(nid, {
      left: [layout.inFaceLeft, layout.outFaceLeft],
      right: [layout.inFaceRight, layout.outFaceRight],
    })
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
    const bR = n.bearing * PI / 180
    const outFace: LatLon = [
      n.pos[0] + cos(bR) / spLs * layout.approachLen,
      n.pos[1] + sin(bR) * layout.approachLen,
    ]
    srcTrunkPairs.set(nid, offsetCurve(straightLine(n.pos, outFace, bezierN), layout.halfW, refLat))
  }

  // (Node-boundary alignment removed — was experimental, degraded multi-poly)

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

  /** Compute [lon, lat] boundary corners for a through-node. */
  function nodeBoundaryCorner(nodeId: string, side: 'left' | 'right', face: 'in' | 'out'): [number, number] {
    const layout = layouts.get(nodeId)!
    const n = layout.node
    const nodeLs = lngScale(refLat)
    const [fLat, fLon] = fwd(n.bearing)
    const [pLat, pLon] = perpL(n.bearing)
    const sign = side === 'left' ? 1 : -1
    const faceSign = face === 'out' ? 1 : -1
    const lat = n.pos[0] + fLat * layout.approachLen * faceSign + pLat * layout.halfW * sign
    const lon = n.pos[1] + fLon * layout.approachLen * faceSign * nodeLs + pLon * layout.halfW * sign * nodeLs
    return [lon, lat]
  }

  // Track which sources get traced (to avoid duplicate standalone traces)
  const tracedSources = new Set<string>()

  /** Recursively trace a branch: forward along left edges to sink,
   *  then backward along right edges. Appends directly to `ring`. */
  function traceBranch(nodeId: string, arrivedViaEdge: string | null, ring: [number, number][]) {
    const layout = layouts.get(nodeId)!

    // --- Forward: left edges of this node's prefix ---
    if (layout.isSource) {
      tracedSources.add(nodeId)
      const tp = srcTrunkPairs.get(nodeId)
      if (tp) ring.push(...tp.left)
    }

    const outs = sortedOuts(nodeId)

    // --- Sink: straight trunk + isosceles arrowhead ---
    // The offset curve ends at the input face (approachLen behind node).
    // From there, a straight trunk of nodeApproach*halfW connects to the
    // arrowhead base, then wingL → tip → wingR.
    if (layout.isSink) {
      const n = layout.node
      const bRad = n.bearing * PI / 180
      // Screen-space directions
      const sFwd: [number, number] = [sin(bRad), cos(bRad) / ls]  // [dLon, dLat]
      const sPerp: [number, number] = [-cos(bRad), sin(bRad) / ls] // [dLon, dLat]
      const arrowH = layout.halfW * 2 * arrowLen
      // Arrow base position (arrowH behind tip)
      const abLon = n.pos[1] - sFwd[0] * arrowH
      const abLat = n.pos[0] - sFwd[1] * arrowH
      const hw = layout.halfW
      const trunkL: [number, number] = [abLon + sPerp[0] * hw, abLat + sPerp[1] * hw]
      const trunkR: [number, number] = [abLon - sPerp[0] * hw, abLat - sPerp[1] * hw]
      const wingW = hw * arrowWing
      const wingL: [number, number] = [abLon + sPerp[0] * wingW, abLat + sPerp[1] * wingW]
      const wingR: [number, number] = [abLon - sPerp[0] * wingW, abLat - sPerp[1] * wingW]
      const tip: [number, number] = [n.pos[1], n.pos[0]]
      ring.push(trunkL, wingL, tip, wingR, trunkR)
      return
    }

    // --- Merge: trace side inputs as backward branches, then output ---
    // Side inputs "above" the main input (in perp order) are traced
    // BEFORE the output: left reversed → recurse to source → right.
    // This gives the correct outer perimeter for Y-shaped merges.
    const ins = sortedIns(nodeId)
    const mainIdx = arrivedViaEdge
      ? ins.findIndex(e => eid(e) === arrivedViaEdge)
      : -1

    // sortedIns ascending by perpProjection:
    //   low index = RIGHT of bearing (south for ~east bearing)
    //   high index = LEFT of bearing (north for ~east bearing)

    /** Find how many points to skip at a crease by detecting where two
     *  inner edges converge (distance < threshold). Walk backward from
     *  the merge face end of both edges. */
    function creaseConvergence(
      edgeA: [number, number][], edgeB: [number, number][],
      threshold: number,
    ): number {
      const nA = edgeA.length, nB = edgeB.length
      let skip = 0
      for (let k = 0; k < Math.min(nA, nB); k++) {
        const a = edgeA[nA - 1 - k], b = edgeB[nB - 1 - k]
        const dLon = (a[0] - b[0]) * ls, dLat = (a[1] - b[1]) * ls
        if (dLon * dLon + dLat * dLat > threshold * threshold) break
        skip = k + 1
      }
      return creaseSkip === 0 ? 0 : Math.max(skip, creaseSkip)
    }

    const hasNorthIns = mainIdx >= 0 && mainIdx < ins.length - 1
    const hasSouthIns = mainIdx > 0

    // Pop main input face points at north crease
    if (hasNorthIns) {
      const mainEp = arrivedViaEdge ? edgePairs.get(arrivedViaEdge) : null
      const sideEp = edgePairs.get(eid(ins[mainIdx + 1]))
      const skip = mainEp && sideEp
        ? creaseConvergence(mainEp.left, sideEp.right, layout.halfW * 0.5)
        : creaseSkip
      for (let k = 0; k < skip && ring.length > 0; k++) ring.pop()
    }

    // LEFT/north side inputs (indices > mainIdx, innermost first)
    if (mainIdx >= 0) {
      for (let i = mainIdx + 1; i < ins.length; i++) {
        const sideEdge = ins[i]
        const ep = edgePairs.get(eid(sideEdge))!
        // Detect convergence between this inner edge and the output/main edge
        const mainEp = arrivedViaEdge ? edgePairs.get(arrivedViaEdge) : null
        const skip = mainEp
          ? creaseConvergence(mainEp.left, ep.right, layout.halfW * 0.5)
          : creaseSkip
        const rRev = [...ep.right].reverse()
        ring.push(...rRev.slice(skip))
        const srcL = layouts.get(sideEdge.from)!
        if (srcL.isSource) {
          tracedSources.add(sideEdge.from)
          const tp = srcTrunkPairs.get(sideEdge.from)
          if (tp) { ring.push(...[...tp.right].reverse()); ring.push(...tp.left) }
        }
        ring.push(...(skip > 0 ? ep.left.slice(0, -skip) : ep.left))
      }
    }

    // --- Forward: trace each output branch ---
    // Iterate from northmost to southmost. At crease transitions between
    // outputs, skip face endpoints to prevent seams.
    const outsList: GFlowEdge[] = []
    for (let i = outs.length - 1; i >= 0; i--) outsList.push(outs[i])
    const hasNorthInputs = mainIdx >= 0 && mainIdx < ins.length - 1
    const hasSouthInputs = mainIdx > 0
    for (let i = 0; i < outsList.length; i++) {
      const outEdge = outsList[i]
      const ep = edgePairs.get(eid(outEdge))!
      // Skip face endpoints at crease transitions — no midpoints needed,
      // the polygon connects directly between the second-to-last points.
      const skipLeft0 = i > 0 || hasNorthInputs
      const skipRight0 = i < outsList.length - 1 || hasSouthInputs
      // Skip left[n-1] at dest merge crease (traceBranch pops it if needed)
      ring.push(...(skipLeft0 ? ep.left.slice(creaseSkip) : ep.left))
      traceBranch(outEdge.to, eid(outEdge), ring)
      // Skip right[n-1] at dest merge crease (south-side inputs)
      const dstLayout = layouts.get(outEdge.to)!
      const dstIns = sortedIns(outEdge.to)
      const dstMainIdx = dstIns.findIndex(e => eid(e) === eid(outEdge))
      const dstHasSouthInputs = dstMainIdx > 0
      const rRev = [...ep.right].reverse()
      const skipRightFirst = dstHasSouthInputs // skip right[n-1] at dest face
      const cs = creaseSkip
      let rSlice = rRev
      if (skipRightFirst && cs > 0) rSlice = rSlice.slice(cs)
      if (skipRight0 && cs > 0) rSlice = rSlice.slice(0, -cs)
      ring.push(...rSlice)
    }

    // RIGHT/south side inputs (indices < mainIdx, innermost first)
    if (mainIdx >= 0) {
      for (let i = mainIdx - 1; i >= 0; i--) {
        const sideEdge = ins[i]
        const ep = edgePairs.get(eid(sideEdge))!
        // Detect convergence between this inner edge and the main input
        const mainEp = arrivedViaEdge ? edgePairs.get(arrivedViaEdge) : null
        const skip = mainEp
          ? creaseConvergence(mainEp.right, ep.left, layout.halfW * 0.5)
          : creaseSkip
        const rRev = [...ep.right].reverse()
        ring.push(...rRev.slice(skip))
        const srcL = layouts.get(sideEdge.from)!
        if (srcL.isSource) {
          tracedSources.add(sideEdge.from)
          const tp = srcTrunkPairs.get(sideEdge.from)
          if (tp) { ring.push(...[...tp.right].reverse()); ring.push(...tp.left) }
        }
        ring.push(...(skip > 0 ? ep.left.slice(0, -skip) : ep.left))
      }
    }

    if (layout.isSource) {
      const tp = srcTrunkPairs.get(nodeId)
      if (tp) ring.push(...[...tp.right].reverse())
    }
  }

  // Find the main source: pick the source with highest throughput
  // that feeds into the first input of its destination
  const features: GeoJSON.Feature[] = []
  const sourcesByWeight = [...layouts.entries()]
    .filter(([, l]) => l.isSource)
    .sort((a, b) => b[1].throughWeight - a[1].throughWeight)

  for (const [nid] of sourcesByWeight) {
    if (tracedSources.has(nid)) continue
    const outs = sortedOuts(nid)
    if (outs.length === 0) continue
    // Check if this source is a side-input to a merge (not the first input)
    const destIns = sortedIns(outs[0].to)
    if (destIns.length > 0 && eid(destIns[0]) !== eid(outs[0])) continue

    let ring: [number, number][] = []
    traceBranch(nid, null, ring)
    if (ring.length > 0) {
      ring = simplifyRing(ring)
      ring.push(ring[0])
      const w = pxW(pxPerWeight, layouts.get(nid)!.throughWeight)
      features.push(ringFeature(ring, { color, width: w, key: `sp-${nid}`, opacity: 1 }))
    }
  }

  return { type: 'FeatureCollection', features }
}


