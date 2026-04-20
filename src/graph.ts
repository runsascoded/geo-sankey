import type { LatLon } from './types'
import { lngScale, pxToHalfDeg, pxToDeg, degPerPxZ12 } from './geo'
import { directedBezier, perpAt } from './path'
import { ribbon, ribbonArrow, ribbonEdges, ribbonArrowEdges, ringFeature } from './ribbon'
import type { RibbonArrowOpts } from './ribbon'

const { cos, sin, PI, max } = Math


// --- Public types ---

export interface NodeStyle {
  color?: string
  radius?: number
  icon?: string          // emoji, symbol, or image URL
  labelColor?: string
  labelSize?: number
  labelOffset?: [number, number]
  hidden?: boolean
}

export interface EdgeStyle {
  /** Ribbon fill color for this edge (overrides `FlowGraphOpts.color`). */
  color?: string
  /** Per-edge opacity multiplier (0..1), composed with the page-level opacity. */
  opacity?: number
  /** Multiplier on `pxPerWeight` for this edge's ribbon width. Default 1. */
  widthScale?: number
}

export interface GFlowNode {
  id: string
  pos: LatLon
  /** Bearing of throughput axis (degrees, 0=N 90=E). Inputs merge from
   *  behind, outputs split ahead. Optional — auto-derived for nodes with
   *  a single output or sinks with a single input; defaults to 90. */
  bearing?: number
  /** Bezier control-point distance for edges at this node (G1 smoothness:
   *  all edges leaving/arriving share one velocity). Units: scaled-degree
   *  space used internally by `directedBezier`. Undefined → heuristic. */
  velocity?: number
  label?: string
  style?: NodeStyle
}

export interface GFlowEdge {
  from: string
  to: string
  /** Numeric weight, or `'auto'` to derive from upstream inputs. */
  weight: number | 'auto'
  style?: EdgeStyle
}

export interface FlowGraph {
  nodes: GFlowNode[]
  edges: GFlowEdge[]
}

export interface FlowGraphOpts {
  refLat: number
  zoom: number
  geoScale?: number
  /** Pixels of ribbon width per unit weight. Ignored if `mPerWeight` is set. */
  pxPerWeight: number | ((w: number) => number)
  /** Real-world meters per unit weight; overrides `pxPerWeight` when set,
   *  computing px-per-frame from the current zoom + `refLat`. */
  mPerWeight?: number
  color: string
  arrowWing?: number        // wing width multiplier (derived from wing+angle if not set)
  arrowLen?: number         // arrow length multiplier (derived from wing+angle if not set)
  wing?: number             // wing extension as fraction of stem width, one side (default 0.3)
  angle?: number            // wingtip half-angle in degrees (default 45, range 1-60)
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

/** Find intersection of two line segments (a1→a2) and (b1→b2).
 *  Returns the intersection point [lon, lat] or null if parallel/non-intersecting. */
function segIntersect(
  a1: [number, number], a2: [number, number],
  b1: [number, number], b2: [number, number],
): [number, number] | null {
  const d1x = a2[0] - a1[0], d1y = a2[1] - a1[1]
  const d2x = b2[0] - b1[0], d2y = b2[1] - b1[1]
  const denom = d1x * d2y - d1y * d2x
  if (Math.abs(denom) < 1e-20) return null // parallel
  const t = ((b1[0] - a1[0]) * d2y - (b1[1] - a1[1]) * d2x) / denom
  const u = ((b1[0] - a1[0]) * d1y - (b1[1] - a1[1]) * d1x) / denom
  // Strict: both parameters must be within [0, 1] — actual intersection
  if (t < 0.001 || t > 0.999 || u < 0.001 || u > 0.999) return null
  return [a1[0] + d1x * t, a1[1] + d1y * t]
}

/** Fix nearby self-intersections in a ring. When two segments that are
 *  close in index cross, splice out the inner vertices and replace with
 *  the intersection point. This resolves crease crossings where two
 *  inner edges of a merge/split overlap slightly. */
/** Clean a ring by removing self-intersections. For each pair of crossing
 *  segments, replace the loop between them with the intersection point.
 *  Scans all segment pairs within a window to catch both crease overlaps
 *  and nearby crossings. */
function cleanRing(ring: [number, number][]): [number, number][] {
  // Remove zero-length edges first
  for (let i = ring.length - 2; i >= 0; i--) {
    const dx = ring[i + 1][0] - ring[i][0], dy = ring[i + 1][1] - ring[i][1]
    if (dx * dx + dy * dy < 1e-18) ring.splice(i + 1, 1)
  }
  // Find and fix all self-intersections, starting from shortest loops
  let changed = true
  while (changed) {
    changed = false
    for (let i = 0; i < ring.length - 3 && !changed; i++) {
      for (let j = i + 2; j < ring.length - 1 && !changed; j++) {
        if (i === 0 && j === ring.length - 2) continue // skip closing edge
        const ix = segIntersect(ring[i], ring[i + 1], ring[j], ring[j + 1])
        if (ix) {
          // Replace the loop between i+1 and j with intersection point
          ring.splice(i + 1, j - i, ix)
          changed = true
        }
      }
    }
  }
  return ring
}

/** At a merge/split crease, find where the two adjacent inner edges
 *  intersect. Walk backward from the face and find the intersection of
 *  the last segments. Returns the intersection point or null. */
function creaseIntersection(
  edgeA: [number, number][], // inner edge of arm A (source→merge direction)
  edgeB: [number, number][], // inner edge of arm B (source→merge direction)
): [number, number] | null {
  const nA = edgeA.length, nB = edgeB.length
  if (nA < 2 || nB < 2) return null
  // Try last few segment pairs to find intersection
  for (let a = nA - 2; a >= Math.max(0, nA - 4); a--) {
    for (let b = nB - 2; b >= Math.max(0, nB - 4); b--) {
      const pt = segIntersect(edgeA[a], edgeA[a + 1], edgeB[b], edgeB[b + 1])
      if (pt) return pt
    }
  }
  return null
}

/** Resolve arrowhead params: wing/angle take precedence over arrowWing/arrowLen.
 *  angle = half-angle at the arrow tip (pointy end). */
function resolveArrow(opts: FlowGraphOpts): { arrowWing: number; arrowLen: number } {
  const wing = opts.wing ?? 0.4
  const angle = opts.angle ?? 45
  const arrowWing = opts.arrowWing ?? (1 + 2 * wing)
  // angle = internal angle at each wingtip (between wing edge and base line)
  // tan(angle) = arrowH / wingW, where wingW = arrowWing * halfW
  // arrowLen = arrowH / (2 * halfW) = arrowWing * tan(angle) / 2
  const arrowLen = opts.arrowLen ?? (arrowWing * Math.tan(angle * PI / 180) / 2)
  return { arrowWing, arrowLen }
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

/** Screen-space perpendicular offset matching offsetCurve's formula.
 *  Returns [dLon, dLat] for a `dist` offset perpendicular-left of `bearing`.
 *  `dist` is in lat-degrees (same units as halfW from pxToHalfDeg).
 *  The offset accounts for Mercator lon/lat aspect ratio so the screen-
 *  pixel distance equals `dist * px_per_lat_degree` (= widthPx/2). */
function perpOffset(bearing: number, dist: number, ls: number): [number, number] {
  const rad = bearing * PI / 180
  const cB = cos(rad), sB = sin(rad)
  // Unit perp in [lon, lat*ls] screen space, then convert to geographic:
  // dLon = pLon * dist * ls, dLat = pLat * dist
  const pMag = Math.sqrt(cB * cB * ls * ls + sB * sB)
  const pLon = -cB * ls / pMag
  const pLat = sB / pMag
  return [pLon * dist * ls, pLat * dist]
}

function pxW(pxPerWeight: number | ((w: number) => number), weight: number): number {
  return typeof pxPerWeight === 'number' ? weight * pxPerWeight : pxPerWeight(weight)
}

const M_PER_DEG_LAT = 111_320

/** If `mPerWeight` is set, derive the equivalent `pxPerWeight` for the
 *  current zoom + refLat (web-mercator scaling). Otherwise return the
 *  caller-provided `pxPerWeight`. */
function effectivePxPerWeight(opts: FlowGraphOpts): number | ((w: number) => number) {
  if (opts.mPerWeight == null) return opts.pxPerWeight
  // px/m at zoom z = 2^(z-12) / (degPerPxZ12 * M_PER_DEG_LAT)
  const pxPerMeter = Math.pow(2, opts.zoom - 12) / (degPerPxZ12(opts.refLat) * M_PER_DEG_LAT)
  return opts.mPerWeight * pxPerMeter
}

/** Edge ribbon width in px, honoring per-edge widthScale if set. */
function edgePx(e: GFlowEdge, pxPerWeight: number | ((w: number) => number), weights: Map<string, number>): number {
  return pxW(pxPerWeight, weights.get(eid(e)) ?? 0) * (e.style?.widthScale ?? 1)
}

function eid(e: GFlowEdge): string {
  return `${e.from}→${e.to}`
}

/** Resolve `'auto'` edge weights via topological propagation:
 *  - Through-node output (1 input, 1 output): output = input weight.
 *  - Merge output (≥1 input, 1 auto output): output = sum of inputs.
 *  - Split outputs (1 input, multiple outputs): auto outputs share the
 *    remainder (input − sum of explicit outputs) equally.
 *  Unresolvable edges (cycles, missing source weight) default to 0
 *  with a console warning. */
export function resolveEdgeWeights(graph: FlowGraph): Map<string, number> {
  const out = new Map<string, number>()
  const inEdges = new Map<string, GFlowEdge[]>()
  const outEdges = new Map<string, GFlowEdge[]>()
  for (const n of graph.nodes) { inEdges.set(n.id, []); outEdges.set(n.id, []) }
  for (const e of graph.edges) {
    outEdges.get(e.from)?.push(e)
    inEdges.get(e.to)?.push(e)
  }
  // Iterate to a fixed point. Each pass resolves any edge whose source
  // node has all its inputs (and explicit-weight siblings) known.
  let progress = true
  while (progress && out.size < graph.edges.length) {
    progress = false
    for (const e of graph.edges) {
      const id = eid(e)
      if (out.has(id)) continue
      if (typeof e.weight === 'number') {
        out.set(id, e.weight)
        progress = true
        continue
      }
      const ins = inEdges.get(e.from) ?? []
      if (!ins.every(ie => out.has(eid(ie)))) continue
      const totalIn = ins.reduce((s, ie) => s + (out.get(eid(ie)) ?? 0), 0)
      const outs = outEdges.get(e.from) ?? []
      const explicit = outs
        .filter(oe => typeof oe.weight === 'number')
        .reduce((s, oe) => s + (oe.weight as number), 0)
      const autoCount = outs.filter(oe => oe.weight === 'auto').length
      const share = autoCount > 0 ? Math.max(0, totalIn - explicit) / autoCount : 0
      out.set(id, share)
      progress = true
    }
  }
  for (const e of graph.edges) {
    if (!out.has(eid(e))) {
      console.warn(`[geo-sankey] could not resolve auto weight for ${eid(e)}`)
      out.set(eid(e), 0)
    }
  }
  return out
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

    // Apply offset. `halfW` is in lat-degrees; convert:
    //   - LON offset (deg lon) = pLon * halfW * ls (lat→lon scaling at refLat)
    //   - LAT offset (deg lat) = pLat * halfW (no conversion)
    // Dividing lat by ls / omitting ls from lon both shrink the ribbon by
    // 1/ls ≈ cos(refLat), which is the bug described in
    // specs/offsetCurve-ls-scaling.md.
    left.push([path[i][1] + pLon * halfW * ls, path[i][0] + pLat * halfW])
    right.push([path[i][1] - pLon * halfW * ls, path[i][0] - pLat * halfW])
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

function computeLayout(graph: FlowGraph, opts: FlowGraphOpts, alignThroughWidth = false): { layouts: Map<string, NodeLayout>; weights: Map<string, number> } {
  // Clone nodes to avoid mutating the input graph (auto-bearing overwrites n.bearing)
  const nodes = graph.nodes.map(n => ({ ...n, pos: [...n.pos] as LatLon }))
  graph = { ...graph, nodes }
  const { refLat, zoom, geoScale = 1, nodeApproach = 0.5 } = opts
  const pxPerWeight = effectivePxPerWeight(opts)
  const { arrowLen } = resolveArrow(opts)
  const weights = resolveEdgeWeights(graph)
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

  // Auto-compute bearing from edge directions (only when not explicitly set).
  // Single output → toward dest. Sink with single input → from source.
  // Fallback to 90° (east) if no edges and no declared bearing.
  for (const n of graph.nodes) {
    if (n.bearing != null) continue
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
    } else {
      n.bearing = 90
    }
  }

  for (const n of graph.nodes) {
    // Per-edge widthScale is applied as a weight multiplier so node
    // geometry (face widths, slot positions) matches the rendered ribbon.
    const scaledW = (e: GFlowEdge) => (weights.get(eid(e)) ?? 0) * (e.style?.widthScale ?? 1)
    const inW = inEdgesOf.get(n.id)!.reduce((s, e) => s + scaledW(e), 0)
    const outW = outEdgesOf.get(n.id)!.reduce((s, e) => s + scaledW(e), 0)
    const throughW = max(inW, outW)
    const halfW = pxToHalfDeg(pxW(pxPerWeight, throughW), zoom, geoScale, refLat)
    const bRad = n.bearing * PI / 180
    const fwdLon = sin(bRad), fwdLat = cos(bRad) / ls
    // Screen-space perpendicular offset (matching offsetCurve's formula)
    const [pDLon, pDLat] = perpOffset(n.bearing, halfW, ls)
    const isSink = outEdgesOf.get(n.id)!.length === 0 && inW > 0
    const ap = isSink
      ? halfW * 2 * arrowLen
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
      // Face corners [lon, lat] — perpOffset matches offsetCurve width
      inFaceLeft:   [n.pos[1] - fwdLon * ap + pDLon, n.pos[0] - fwdLat * ap + pDLat],
      inFaceRight:  [n.pos[1] - fwdLon * ap - pDLon, n.pos[0] - fwdLat * ap - pDLat],
      outFaceLeft:  [n.pos[1] + fwdLon * ap + pDLon, n.pos[0] + fwdLat * ap + pDLat],
      outFaceRight: [n.pos[1] + fwdLon * ap - pDLon, n.pos[0] + fwdLat * ap - pDLat],
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
    const sFwdLon = sin(bRad), sFwdLat = cos(bRad) / ls

    // Input slots
    const inEdges = inEdgesOf.get(n.id)!
    inEdges.sort((a, b) =>
      perpProjection(nodeMap.get(a.from)!.pos, n.pos, n.bearing, ls) -
      perpProjection(nodeMap.get(b.from)!.pos, n.pos, n.bearing, ls)
    )
    const throughPx = pxW(pxPerWeight, layout.throughWeight)
    const inTotalPx = inEdges.reduce((s, e) => s + edgePx(e, pxPerWeight, weights), 0)
    const inBasePx = alignThroughWidth ? throughPx : inTotalPx
    let inCum = 0
    for (const e of inEdges) {
      const ePx = edgePx(e, pxPerWeight, weights)
      const centerOffset = -inBasePx / 2 + inCum + ePx / 2
      inCum += ePx
      const offsetDeg = pxToDeg(centerOffset, zoom, geoScale, refLat)
      const [sDLon, sDLat] = perpOffset(n.bearing, offsetDeg, ls)
      layout.inSlots.set(eid(e), {
        pos: [
          n.pos[0] - sFwdLat * layout.approachLen + sDLat,
          n.pos[1] - sFwdLon * layout.approachLen + sDLon,
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
    const outTotalPx = outEdges.reduce((s, e) => s + edgePx(e, pxPerWeight, weights), 0)
    const outBasePx = alignThroughWidth ? throughPx : outTotalPx
    let outCum = 0
    for (const e of outEdges) {
      const ePx = edgePx(e, pxPerWeight, weights)
      const centerOffset = -outBasePx / 2 + outCum + ePx / 2
      outCum += ePx
      const offsetDeg = pxToDeg(centerOffset, zoom, geoScale, refLat)
      const [sDLon, sDLat] = perpOffset(n.bearing, offsetDeg, ls)
      layout.outSlots.set(eid(e), {
        pos: [
          n.pos[0] + sFwdLat * layout.approachLen + sDLat,
          n.pos[1] + sFwdLon * layout.approachLen + sDLon,
        ],
        halfW: pxToHalfDeg(ePx, zoom, geoScale, refLat),
        bearing: n.bearing,
      })
    }
  }

  return { layouts, weights }
}

/** Return debug geometry: edge center-line beziers and approach rectangles. */
export function renderFlowGraphDebug(
  graph: FlowGraph,
  opts: FlowGraphOpts,
): GeoJSON.FeatureCollection {
  const { bezierN = 20 } = opts
  const { layouts, weights } = computeLayout(graph, opts, true)
  const features: GeoJSON.Feature[] = []
  const debugLs = lngScale(opts.refLat)

  // Edge center-line beziers
  for (const edge of graph.edges) {
    const id = eid(edge)
    const srcLayout = layouts.get(edge.from)!
    const dstLayout = layouts.get(edge.to)!
    const srcSlot = srcLayout.outSlots.get(id)!
    const dstSlot = dstLayout.inSlots.get(id)!
    const path = directedBezier(srcSlot.pos, dstSlot.pos, srcSlot.bearing, dstSlot.bearing, bezierN, debugLs, srcLayout.node.velocity, dstLayout.node.velocity)
    features.push({
      type: 'Feature',
      properties: { kind: 'bezier', edge: id, weight: weights.get(id) ?? 0 },
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

  const { arrowWing, arrowLen } = resolveArrow(opts)
  const { nodeApproach = 0.5 } = opts

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

/** Return per-edge bezier centerlines as LineString features. Used by the
 *  editor to hit-test edges even when the ribbon rendering merges them
 *  (singlePoly mode) or a user wants an invisible selection overlay. */
export function renderEdgeCenterlines(
  graph: FlowGraph,
  opts: FlowGraphOpts,
): GeoJSON.FeatureCollection {
  const { refLat, bezierN = 20 } = opts
  const { layouts, weights } = computeLayout(graph, opts)
  const ls = lngScale(refLat)
  const features: GeoJSON.Feature[] = []
  for (const edge of graph.edges) {
    const id = eid(edge)
    const srcLayout = layouts.get(edge.from)!
    const dstLayout = layouts.get(edge.to)!
    const srcSlot = srcLayout.outSlots.get(id)!
    const dstSlot = dstLayout.inSlots.get(id)!
    const path = directedBezier(srcSlot.pos, dstSlot.pos, srcSlot.bearing, dstSlot.bearing, bezierN, ls, srcLayout.node.velocity, dstLayout.node.velocity)
    features.push({
      type: 'Feature',
      properties: { id, from: edge.from, to: edge.to },
      geometry: { type: 'LineString', coordinates: path.map(p => [p[1], p[0]]) },
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
    refLat, zoom, geoScale = 1, color,
    minArrowWingPx = 0, bezierN = 20,
  } = opts
  const pxPerWeight = effectivePxPerWeight(opts)
  const { arrowWing, arrowLen } = resolveArrow(opts)
  const { layouts, weights } = computeLayout(graph, opts)
  const features: GeoJSON.Feature[] = []
  const renderLs = lngScale(refLat)

  // 1. Render each edge as a bezier ribbon
  for (const edge of graph.edges) {
    const id = eid(edge)
    const srcLayout = layouts.get(edge.from)!
    const dstLayout = layouts.get(edge.to)!
    const srcSlot = srcLayout.outSlots.get(id)!
    const dstSlot = dstLayout.inSlots.get(id)!
    const ePx = edgePx(edge, pxPerWeight, weights)
    const halfW = pxToHalfDeg(ePx, zoom, geoScale, refLat)

    const path = directedBezier(srcSlot.pos, dstSlot.pos, srcSlot.bearing, dstSlot.bearing, bezierN, renderLs, srcLayout.node.velocity, dstLayout.node.velocity)
    const ring = ribbon(path, halfW, refLat)
    if (ring.length) {
      features.push(ringFeature(ring, {
        color: edge.style?.color ?? color,
        width: ePx,
        key: id,
        opacity: edge.style?.opacity ?? 1,
        from: edge.from,
        to: edge.to,
      }))
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
    refLat, zoom, geoScale = 1, color,
    minArrowWingPx = 0,
    plugBearingDeg = 1, plugFraction = 0.3, creaseSkip = 1,
    bezierN = 20,
  } = opts
  const pxPerWeight = effectivePxPerWeight(opts)
  const { arrowWing, arrowLen } = resolveArrow(opts)
  const { layouts, weights } = computeLayout(graph, opts, true) // align slots to through-width
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
    const ePx = edgePx(edge, pxPerWeight, weights)
    const halfW = pxToHalfDeg(ePx, zoom, geoScale, refLat)
    const path = directedBezier(srcSlot.pos, dstSlot.pos, srcSlot.bearing, dstSlot.bearing, bezierN, spLs, srcLayout.node.velocity, dstLayout.node.velocity)
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
    const bRad = n.bearing * PI / 180
    const fwdLon = sin(bRad), fwdLat = cos(bRad) / ls
    const [pDLon, pDLat] = perpOffset(n.bearing, layout.halfW, ls)
    const sign = side === 'left' ? 1 : -1
    const faceSign = face === 'out' ? 1 : -1
    return [
      n.pos[1] + fwdLon * layout.approachLen * faceSign + pDLon * sign,
      n.pos[0] + fwdLat * layout.approachLen * faceSign + pDLat * sign,
    ]
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
      const sFwdLon = sin(bRad), sFwdLat = cos(bRad) / ls
      const arrowH = layout.halfW * 2 * arrowLen
      const abLon = n.pos[1] - sFwdLon * arrowH
      const abLat = n.pos[0] - sFwdLat * arrowH
      const [pDLon, pDLat] = perpOffset(n.bearing, layout.halfW, ls)
      const trunkL: [number, number] = [abLon + pDLon, abLat + pDLat]
      const trunkR: [number, number] = [abLon - pDLon, abLat - pDLat]
      const [wDLon, wDLat] = perpOffset(n.bearing, layout.halfW * arrowWing, ls)
      const wingL: [number, number] = [abLon + wDLon, abLat + wDLat]
      const wingR: [number, number] = [abLon - wDLon, abLat - wDLat]
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

    // LEFT/north side inputs (indices > mainIdx, innermost first)
    // Push full edges — cleanRing will remove doubled-back crease edges.
    if (mainIdx >= 0) {
      for (let i = mainIdx + 1; i < ins.length; i++) {
        const sideEdge = ins[i]
        const ep = edgePairs.get(eid(sideEdge))!
        const rRev = [...ep.right].reverse()
        ring.push(...rRev)
        const srcL = layouts.get(sideEdge.from)!
        if (srcL.isSource) {
          tracedSources.add(sideEdge.from)
          const tp = srcTrunkPairs.get(sideEdge.from)
          if (tp) { ring.push(...[...tp.right].reverse()); ring.push(...tp.left) }
        }
        ring.push(...ep.left)
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
      // Push full edges — cleanRing handles crease doubled edges.
      ring.push(...ep.left)
      traceBranch(outEdge.to, eid(outEdge), ring)
      ring.push(...[...ep.right].reverse())
    }

    // RIGHT/south side inputs (indices < mainIdx, innermost first)
    if (mainIdx >= 0) {
      for (let i = mainIdx - 1; i >= 0; i--) {
        const sideEdge = ins[i]
        const ep = edgePairs.get(eid(sideEdge))!
        const rRev = [...ep.right].reverse()
        ring.push(...rRev)
        const srcL = layouts.get(sideEdge.from)!
        if (srcL.isSource) {
          tracedSources.add(sideEdge.from)
          const tp = srcTrunkPairs.get(sideEdge.from)
          if (tp) { ring.push(...[...tp.right].reverse()); ring.push(...tp.left) }
        }
        ring.push(...ep.left)
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
      if (creaseSkip > 0) {
        ring = cleanRing(ring)
        ring = simplifyRing(ring)
      }
      ring.push(ring[0])
      const w = pxW(pxPerWeight, layouts.get(nid)!.throughWeight)
      features.push(ringFeature(ring, { color, width: w, key: `sp-${nid}`, opacity: 1 }))
    }
  }

  return { type: 'FeatureCollection', features }
}

export type NodeRole = 'source' | 'sink' | 'split' | 'merge' | 'through'

export interface NodePointProperties {
  id: string
  label: string
  role: NodeRole
  bearing: number
  color?: string
  radius?: number
  icon?: string
  labelColor?: string
  labelSize?: number
  labelOffset?: [number, number]
  hidden?: boolean
  [k: string]: unknown
}

/** Classify each node and return a GeoJSON FeatureCollection of Points.
 *  Each feature carries `NodePointProperties` including the node's role
 *  (source/sink/split/merge/through) and any per-node style overrides. */
export function renderNodes(
  graph: FlowGraph,
  filter?: 'all' | 'endpoints' | NodeRole[],
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const inDeg = new Map<string, number>()
  const outDeg = new Map<string, number>()
  for (const n of graph.nodes) { inDeg.set(n.id, 0); outDeg.set(n.id, 0) }
  for (const e of graph.edges) {
    inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1)
    outDeg.set(e.from, (outDeg.get(e.from) ?? 0) + 1)
  }
  function classify(id: string): NodeRole {
    const inD = inDeg.get(id) ?? 0
    const outD = outDeg.get(id) ?? 0
    if (inD === 0) return 'source'
    if (outD === 0) return 'sink'
    if (outD > 1) return 'split'
    if (inD > 1) return 'merge'
    return 'through'
  }
  const filterSet = filter === 'endpoints' ? new Set<NodeRole>(['source', 'sink'])
    : Array.isArray(filter) ? new Set(filter)
    : null // 'all' or undefined
  const features: GeoJSON.Feature<GeoJSON.Point>[] = []
  for (const n of graph.nodes) {
    const role = classify(n.id)
    if (filterSet && !filterSet.has(role)) continue
    if (n.style?.hidden) continue
    const props: NodePointProperties = {
      id: n.id,
      label: n.label ?? n.id,
      role,
      bearing: n.bearing,
      ...n.style,
    }
    features.push({
      type: 'Feature',
      properties: props,
      geometry: { type: 'Point', coordinates: [n.pos[1], n.pos[0]] },
    })
  }
  return { type: 'FeatureCollection', features }
}
