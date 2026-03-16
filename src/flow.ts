import type { LatLon, FlowNode, FlowTree, RibbonProperties } from './types'
import { lngScale, pxToHalfDeg, pxToDeg } from './geo'
import { directedBezier, bearingPerpLeft } from './path'
import { ribbon, ribbonArrow, ribbonEdges, ribbonArrowEdges, ringFeature } from './ribbon'
import type { RibbonArrowOpts } from './ribbon'

const { cos, sin, PI } = Math

function straightLine(start: LatLon, end: LatLon, n = 20): LatLon[] {
  const pts: LatLon[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    pts.push([start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t])
  }
  return pts
}

/** Get the representative position of a node (for sorting). */
function childPos(node: FlowNode): LatLon {
  return node.pos
}

/** Compute the total weight of a flow tree node. */
export function nodeWeight(node: FlowNode): number {
  if (node.type === 'source') return node.weight
  return node.children.reduce((s, c) => s + nodeWeight(c), 0)
}

/** Collect all leaf source positions from a flow tree. */
export function flowSources(node: FlowNode): { label: string; pos: LatLon }[] {
  if (node.type === 'source') return [{ label: node.label, pos: node.pos }]
  return node.children.flatMap(c => flowSources(c))
}

export interface RenderFlowTreeOpts {
  refLat: number
  zoom: number
  geoScale: number
  color: string
  key: string
  /** Pixels per unit weight at current scale */
  pxPerWeight: (weight: number) => number
  arrowWing: number
  arrowLen: number
  /** If true, reverse path direction (for "leaving" flows) */
  reverse?: boolean
  /** Fraction of trunk half-width used as distance convergence threshold for
   *  plugging inner comb crevices in single-poly mode. Lower = longer crevices,
   *  higher = earlier plug. Default 0.3. Set to 0 to disable distance-based plugging. */
  plugFraction?: number
  /** Bearing convergence threshold in degrees for plugging inner comb crevices.
   *  When adjacent inner edge directions are within this angle of parallel,
   *  the crevice is plugged. Default 1. Set to 0 to disable bearing-based plugging. */
  plugBearingDeg?: number
}

/** Compute pixel width for a node. For merge nodes, width is the exact sum
 *  of children widths (not independently computed from total weight) to
 *  ensure seamless tiling at junctions. */
export function nodeWidth(node: FlowNode, pxPerWeight: (w: number) => number): number {
  if (node.type === 'source') return pxPerWeight(node.weight)
  return node.children.reduce((s, c) => s + nodeWidth(c, pxPerWeight), 0)
}

/** Render a single flow tree, returning GeoJSON polygon features. */
export function renderFlowTree(
  tree: FlowTree,
  opts: RenderFlowTreeOpts,
  junctionMap?: Map<string, JunctionSlot>,
): GeoJSON.Feature[] {
  const features: GeoJSON.Feature[] = []
  const { refLat, zoom, geoScale, color, key, pxPerWeight, arrowWing, arrowLen, reverse } = opts

  function renderNode(
    node: FlowNode,
    targetPos: LatLon,
    terminal: boolean,
    arriveBearing?: number,
    approachPts?: LatLon[],
  ) {
    const width = nodeWidth(node, pxPerWeight)
    const hw = pxToHalfDeg(width, zoom, geoScale, refLat)

    // Skip weight-only placeholder sources (empty label = no visual path)
    if (node.type === 'source' && !node.label) return

    const isMergeOrSplit = node.type === 'merge' || node.type === 'split'
    let departBearing: number | undefined
    if (isMergeOrSplit) {
      departBearing = node.bearing
    } else if (node.type === 'source' && node.bearing != null) {
      departBearing = node.bearing
    } else {
      departBearing = arriveBearing
    }
    let curveStart = node.pos
    const straightStart: LatLon[] = []
    if (isMergeOrSplit) {
      const hw2 = pxToHalfDeg(width, zoom, geoScale, refLat)
      const depLen = hw2 * 1.5
      const rad = node.bearing * PI / 180
      const ls = lngScale(refLat)
      curveStart = [node.pos[0] + cos(rad) * depLen, node.pos[1] + sin(rad) * depLen * ls]
      straightStart.push(node.pos)
    }
    // For terminal trunks (no arriveBearing), use a straight line to the destination
    // instead of a bezier, so the trunk comes straight in
    // For terminal split nodes, the trunk goes from destPos (origin) to the
    // split pos — reversed direction, no arrowhead.
    const isTerminalSplit = terminal && node.type === 'split'
    let path: LatLon[]
    if (isTerminalSplit) {
      // Trunk: origin (targetPos) → split point (node.pos), straight
      path = straightLine(targetPos, node.pos)
      if (reverse) path = [...path].reverse()
    } else {
      let curvePts: LatLon[]
      if (arriveBearing != null) {
        curvePts = directedBezier(curveStart, targetPos, departBearing, arriveBearing)
      } else if (terminal && isMergeOrSplit) {
        // Terminal trunk from merge/split: depart at node.bearing, curve to dest
        curvePts = directedBezier(curveStart, targetPos, departBearing)
      } else if (terminal) {
        // Terminal source: straight from node pos to dest
        curvePts = straightLine(node.pos, targetPos)
      } else {
        curvePts = straightLine(curveStart, targetPos)
      }
      path = terminal && arriveBearing == null
        ? [...curvePts]
        : [...straightStart, ...curvePts, ...(approachPts ?? [])]
      if (reverse) path = [...path].reverse()
    }

    const arrowOpts: RibbonArrowOpts = { arrowWingFactor: arrowWing, arrowLenFactor: arrowLen, widthPx: width }
    const ring = (terminal && !isTerminalSplit)
      ? ribbonArrow(path, hw, refLat, arrowOpts)
      : ribbon(path, hw, refLat)
    if (ring.length) {
      features.push(ringFeature<RibbonProperties>(ring, { color, width, key, opacity: 1 }))
    }

    if (node.type === 'merge' || node.type === 'split') {
      const [perpLat, perpLon] = bearingPerpLeft(node.bearing)
      const ls = lngScale(refLat)

      const rad = node.bearing * PI / 180
      const fwdLat = cos(rad), fwdLon = sin(rad)
      const approachLen = hw * 1.5

      // Children order = user-specified stacking order (first child = right/south
      // of bearing, last = left/north). No auto-sort — user controls the order.
      const cosRef = cos(refLat * PI / 180)
      const childIndices = node.children.map((_, i) => i)

      const childWidths = childIndices.map(i => nodeWidth(node.children[i], pxPerWeight))
      const totalW = childWidths.reduce((s, w) => s + w, 0)
      let cumW = 0
      for (let ci = 0; ci < childIndices.length; ci++) {
        const cw = childWidths[ci]
        const centerOffset = -totalW / 2 + cumW + cw / 2
        cumW += cw
        const offsetDeg = pxToDeg(centerOffset, zoom, geoScale, refLat)
        // Junction offset point (on the perpendicular at the node)
        const junctionPt: LatLon = [
          node.pos[0] + perpLat * offsetDeg,
          node.pos[1] + perpLon * offsetDeg * ls,
        ]
        if (node.type === 'merge') {
          // Straight approach segment along bearing → junction point.
          // This guarantees the child ribbon's last segment is parallel to the
          // trunk, producing flush edges at the junction.
          const childApproach: LatLon = [
            junctionPt[0] - fwdLat * approachLen,
            junctionPt[1] - fwdLon * approachLen * ls,
          ]
          const approach = straightLine(childApproach, junctionPt, 5).slice(1) // 5 intermediate pts, skip first (= targetPos)
          renderNode(node.children[childIndices[ci]], childApproach, false, node.bearing, approach)
        } else {
          // Split: straight departure from offset junction point along bearing,
          // then bezier curves to child position. If the child's position
          // matches a merge junction (from the compiled map), target the
          // offset position instead of the merge center.
          const splitChild = node.children[childIndices[ci]]
          let childTarget = splitChild.pos
          let childArriveBearing: number | undefined
          if (junctionMap) {
            const slot = junctionMap.get(posKey(splitChild.pos))
            if (slot) {
              childTarget = slot.offset
              childArriveBearing = slot.bearing
            }
          }
          const childDepart: LatLon = [
            junctionPt[0] + fwdLat * approachLen,
            junctionPt[1] + fwdLon * approachLen * ls,
          ]
          const childW = nodeWidth(splitChild, pxPerWeight)
          const childHw = pxToHalfDeg(childW, zoom, geoScale, refLat)
          const arrBearing = childArriveBearing
            ?? (splitChild.type === 'source' && 'bearing' in splitChild && splitChild.bearing != null
              ? splitChild.bearing : node.bearing)
          const curvePts = directedBezier(childDepart, childTarget, node.bearing, arrBearing)
          let splitPath: LatLon[] = [junctionPt, ...curvePts]
          if (reverse) splitPath = [...splitPath].reverse()
          const splitRing = ribbon(splitPath, childHw, refLat)
          if (splitRing.length) {
            features.push(ringFeature<RibbonProperties>(splitRing, { color, width: childW, key, opacity: 1 }))
          }
          if (splitChild.type !== 'source') {
            renderNode(splitChild, splitChild.pos, false)
          }
        }
      }
    }
  }

  renderNode(tree.root, tree.destPos, true)
  return features
}

/** Edge data for a single branch (source → junction or junction → dest). */
interface BranchEdges {
  left: [number, number][]
  right: [number, number][]
  tip?: [number, number]
}

/** Render a single flow tree as ONE polygon feature (no seams at junctions). */
export function renderFlowTreeSinglePoly(
  tree: FlowTree,
  opts: RenderFlowTreeOpts,
  junctionMap?: Map<string, JunctionSlot>,
): GeoJSON.Feature {
  const { refLat, zoom, geoScale, color, key, pxPerWeight, arrowWing, arrowLen, reverse } = opts

  /**
   * Recursively collect edges for a node's branch (the ribbon from this node
   * to its target) and stitch children into one outer contour.
   *
   * Returns the outer left/right edges of the entire subtree as seen from
   * source→destination direction, plus an optional arrow tip.
   */
  function collectEdges(
    node: FlowNode,
    targetPos: LatLon,
    terminal: boolean,
    arriveBearing?: number,
    approachPts?: LatLon[],
  ): BranchEdges | null {
    const width = nodeWidth(node, pxPerWeight)
    const hw = pxToHalfDeg(width, zoom, geoScale, refLat)

    // Skip weight-only placeholder sources (empty label = no visual path)
    if (node.type === 'source' && !node.label) return null

    const isMergeOrSplit = node.type === 'merge' || node.type === 'split'
    let departBearing: number | undefined
    if (isMergeOrSplit) {
      departBearing = node.bearing
    } else if (node.type === 'source' && node.bearing != null) {
      departBearing = node.bearing
    } else {
      departBearing = arriveBearing
    }
    let curveStart = node.pos
    const straightStart: LatLon[] = []
    if (isMergeOrSplit) {
      const hw2 = pxToHalfDeg(width, zoom, geoScale, refLat)
      const depLen = hw2 * 1.5
      const rad = node.bearing * PI / 180
      const ls = lngScale(refLat)
      curveStart = [node.pos[0] + cos(rad) * depLen, node.pos[1] + sin(rad) * depLen * ls]
      straightStart.push(node.pos)
    }

    const isTerminalSplit = terminal && node.type === 'split'
    let path: LatLon[]
    if (isTerminalSplit) {
      path = straightLine(targetPos, node.pos)
      if (reverse) path = [...path].reverse()
    } else {
      let curvePts: LatLon[]
      if (arriveBearing != null) {
        curvePts = directedBezier(curveStart, targetPos, departBearing, arriveBearing)
      } else if (terminal && isMergeOrSplit) {
        curvePts = directedBezier(curveStart, targetPos, departBearing)
      } else if (terminal) {
        curvePts = straightLine(node.pos, targetPos)
      } else {
        curvePts = straightLine(curveStart, targetPos)
      }
      path = terminal && arriveBearing == null && !isMergeOrSplit
        ? [...curvePts]
        : [...straightStart, ...curvePts, ...(approachPts ?? [])]
      if (reverse) path = [...path].reverse()
    }

    const arrowOpts: RibbonArrowOpts = { arrowWingFactor: arrowWing, arrowLenFactor: arrowLen, widthPx: width }

    // Leaf node (source) or terminal split trunk: just return edges for this segment
    if (node.type === 'source' || isTerminalSplit) {
      if (terminal && !isTerminalSplit) {
        const ae = ribbonArrowEdges(path, hw, refLat, arrowOpts)
        if (ae.left.length === 0) return null
        return { left: ae.left, right: ae.right, tip: ae.tip }
      }
      const e = ribbonEdges(path, hw, refLat)
      if (e.left.length === 0) return null
      return { left: e.left, right: e.right }
    }

    // Merge or split node: compute trunk edges and stitch with children
    let trunkEdges: BranchEdges
    if (terminal && !isTerminalSplit) {
      const ae = ribbonArrowEdges(path, hw, refLat, arrowOpts)
      if (ae.left.length === 0) return null
      trunkEdges = { left: ae.left, right: ae.right, tip: ae.tip }
    } else {
      const e = ribbonEdges(path, hw, refLat)
      if (e.left.length === 0) return null
      trunkEdges = { left: e.left, right: e.right }
    }

    if (node.type === 'merge') {
      return stitchMerge(node, trunkEdges, terminal)
    } else {
      // Split node
      return stitchSplit(node, trunkEdges, terminal)
    }
  }

  function stitchMerge(
    node: FlowNode & { type: 'merge' },
    trunkEdges: BranchEdges,
    terminal: boolean,
  ): BranchEdges | null {
    const [perpLat, perpLon] = bearingPerpLeft(node.bearing)
    const ls = lngScale(refLat)
    const totalNodeW = nodeWidth(node, pxPerWeight)
    const hw = pxToHalfDeg(totalNodeW, zoom, geoScale, refLat)
    const rad = node.bearing * PI / 180
    const fwdLat = cos(rad), fwdLon = sin(rad)
    const approachLen = hw * 1.5

    const childIndices = node.children.map((_, i) => i)
    const childWidths = childIndices.map(i => nodeWidth(node.children[i], pxPerWeight))
    const totalW = childWidths.reduce((s, w) => s + w, 0)

    // Collect edges for each child
    const childEdgesList: (BranchEdges | null)[] = []
    let cumW = 0
    for (let ci = 0; ci < childIndices.length; ci++) {
      const cw = childWidths[ci]
      const centerOffset = -totalW / 2 + cumW + cw / 2
      cumW += cw
      const offsetDeg = pxToDeg(centerOffset, zoom, geoScale, refLat)
      const junctionPt: LatLon = [
        node.pos[0] + perpLat * offsetDeg,
        node.pos[1] + perpLon * offsetDeg * ls,
      ]
      const childApproach: LatLon = [
        junctionPt[0] - fwdLat * approachLen,
        junctionPt[1] - fwdLon * approachLen * ls,
      ]
      const approach = straightLine(childApproach, junctionPt, 5).slice(1)
      childEdgesList.push(
        collectEdges(node.children[childIndices[ci]], childApproach, false, node.bearing, approach)
      )
    }

    // Filter to non-null children
    const validChildren = childEdgesList.filter((e): e is BranchEdges => e !== null)
    if (validChildren.length === 0) return trunkEdges

    // Stitch: the outer contour traces:
    // 1. First child's left edge (source → junction)
    // 2. Trunk's left edge (junction → destination)
    // 3. Arrow tip (if present)
    // 4. Trunk's right edge reversed (destination → junction)
    // 5. Last child's right edge reversed (junction → source)
    // 6. For inner children (right to left): each child's right reversed, then left reversed
    //    This creates the "comb" shape between child branches.
    //
    // For children in path direction (source→junction), left/right edges
    // go from source to junction. The trunk edges go from junction to dest.

    const outerLeft: [number, number][] = []
    const outerRight: [number, number][] = []

    // Left contour: first child's left, then trunk's left
    outerLeft.push(...validChildren[0].left, ...trunkEdges.left)

    // Right contour: last child's right, then trunk's right
    outerRight.push(...validChildren[validChildren.length - 1].right, ...trunkEdges.right)

    // Build the ring
    const ring: [number, number][] = [...outerLeft]
    if (trunkEdges.tip) ring.push(trunkEdges.tip)
    ring.push(...[...outerRight].reverse())

    // Inner comb: trace the gaps between adjacent children's branches.
    // Where inner edges converge (the straight approach segment), use a
    // single shared vertex instead of tracing both coincident edges.
    for (let ci = validChildren.length - 1; ci >= 1; ci--) {
      const innerL = validChildren[ci].left       // source → junction
      const innerR = validChildren[ci - 1].right  // source → junction

      // Find where edges converge walking backward from junction.
      // Two modes (both can be active; first to trigger wins):
      // 1. Distance-based: edges within plugFraction * trunkHalfWidth
      // 2. Bearing-based: edge directions within plugBearingDeg of parallel
      const plugFrac = opts.plugFraction ?? 0.3
      const plugBearing = opts.plugBearingDeg ?? 1
      const distEps = plugFrac > 0 ? (hw * plugFrac) ** 2 : 0
      const bearingCos = plugBearing > 0 ? Math.cos(plugBearing * PI / 180) : 1

      let convergePtL = innerL.length
      let convergePtR = innerR.length
      for (let k = 0; k < Math.min(innerL.length, innerR.length); k++) {
        const li = innerL.length - 1 - k
        const ri = innerR.length - 1 - k

        let converged = false

        // Distance check
        if (plugFrac > 0) {
          const dx = innerL[li][0] - innerR[ri][0]
          const dy = innerL[li][1] - innerR[ri][1]
          if (dx * dx + dy * dy <= distEps) converged = true
        }

        // Bearing check: compare edge directions at this point
        if (!converged && plugBearing > 0 && li > 0 && ri > 0) {
          const ldx = innerL[li][0] - innerL[li - 1][0]
          const ldy = innerL[li][1] - innerL[li - 1][1]
          const rdx = innerR[ri][0] - innerR[ri - 1][0]
          const rdy = innerR[ri][1] - innerR[ri - 1][1]
          const lLen = Math.sqrt(ldx * ldx + ldy * ldy)
          const rLen = Math.sqrt(rdx * rdx + rdy * rdy)
          if (lLen > 0 && rLen > 0) {
            const dot = (ldx * rdx + ldy * rdy) / (lLen * rLen)
            if (dot >= bearingCos) converged = true
          }
        }

        if (!converged) {
          convergePtL = li + 1
          convergePtR = ri + 1
          break
        }
      }
      // Trace divergent portion of inner left, shared midpoint, divergent portion of inner right
      ring.push(...innerL.slice(0, convergePtL))
      if (convergePtL < innerL.length) {
        // Add single shared midpoint at the convergence boundary
        const ml = innerL[convergePtL]
        const mr = innerR[Math.min(convergePtR, innerR.length - 1)]
        ring.push([(ml[0] + mr[0]) / 2, (ml[1] + mr[1]) / 2])
      }
      ring.push(...[...innerR.slice(0, Math.min(convergePtR, innerR.length))].reverse())
    }

    // Close the ring
    ring.push(ring[0])
    return { left: ring, right: [] }
  }

  function stitchSplit(
    node: FlowNode & { type: 'split' },
    trunkEdges: BranchEdges,
    terminal: boolean,
  ): BranchEdges | null {
    const [perpLat, perpLon] = bearingPerpLeft(node.bearing)
    const ls = lngScale(refLat)
    const totalNodeW = nodeWidth(node, pxPerWeight)
    const hw = pxToHalfDeg(totalNodeW, zoom, geoScale, refLat)
    const rad = node.bearing * PI / 180
    const fwdLat = cos(rad), fwdLon = sin(rad)
    const approachLen = hw * 1.5

    const childIndices = node.children.map((_, i) => i)
    const childWidths = childIndices.map(i => nodeWidth(node.children[i], pxPerWeight))
    const totalW = childWidths.reduce((s, w) => s + w, 0)

    // Collect edges for each split child
    const childEdgesList: (BranchEdges | null)[] = []
    let cumW = 0
    for (let ci = 0; ci < childIndices.length; ci++) {
      const cw = childWidths[ci]
      const centerOffset = -totalW / 2 + cumW + cw / 2
      cumW += cw
      const offsetDeg = pxToDeg(centerOffset, zoom, geoScale, refLat)
      const junctionPt: LatLon = [
        node.pos[0] + perpLat * offsetDeg,
        node.pos[1] + perpLon * offsetDeg * ls,
      ]
      const splitChild = node.children[childIndices[ci]]
      let childTarget = splitChild.pos
      let childArriveBearing: number | undefined
      if (junctionMap) {
        const slot = junctionMap.get(posKey(splitChild.pos))
        if (slot) {
          childTarget = slot.offset
          childArriveBearing = slot.bearing
        }
      }
      const childDepart: LatLon = [
        junctionPt[0] + fwdLat * approachLen,
        junctionPt[1] + fwdLon * approachLen * ls,
      ]
      const childW = nodeWidth(splitChild, pxPerWeight)
      const childHw = pxToHalfDeg(childW, zoom, geoScale, refLat)
      const arrBearing = childArriveBearing
        ?? (splitChild.type === 'source' && 'bearing' in splitChild && splitChild.bearing != null
          ? splitChild.bearing : node.bearing)
      const curvePts = directedBezier(childDepart, childTarget, node.bearing, arrBearing)
      let splitPath: LatLon[] = [junctionPt, ...curvePts]
      if (reverse) splitPath = [...splitPath].reverse()
      const e = ribbonEdges(splitPath, childHw, refLat)
      if (e.left.length > 0) {
        childEdgesList.push(e)
      } else {
        childEdgesList.push(null)
      }
    }

    const validChildren = childEdgesList.filter((e): e is BranchEdges => e !== null)
    if (validChildren.length === 0) return trunkEdges

    // For split: trunk goes to junction, then children fan out.
    // Outer contour:
    // 1. Trunk left (origin → split point)
    // 2. First child's left (split → child dest)
    // 3. First child's right reversed (child dest → split)
    // ... inner children ...
    // N. Last child's left (split → child dest)
    // N+1. Last child's right reversed (child dest → split)
    // N+2. Trunk right reversed (split → origin)

    const ring: [number, number][] = []
    // Trunk left
    ring.push(...trunkEdges.left)
    // First child left
    ring.push(...validChildren[0].left)
    // First child right reversed
    ring.push(...[...validChildren[0].right].reverse())
    // Inner children
    for (let ci = 1; ci < validChildren.length; ci++) {
      ring.push(...validChildren[ci].left)
      ring.push(...[...validChildren[ci].right].reverse())
    }
    // Trunk right reversed
    ring.push(...[...trunkEdges.right].reverse())
    // Close
    ring.push(ring[0])
    return { left: ring, right: [] }
  }

  const edges = collectEdges(tree.root, tree.destPos, true)
  if (!edges) {
    return ringFeature<RibbonProperties>([], { color, width: 0, key, opacity: 1 })
  }

  // If the result is already a fully-stitched ring (left contains the full ring, right is empty),
  // use it directly. Otherwise, close left + tip + right into a ring.
  let ring: [number, number][]
  if (edges.right.length === 0) {
    ring = edges.left
  } else {
    ring = [...edges.left]
    if (edges.tip) ring.push(edges.tip)
    ring.push(...[...edges.right].reverse())
    ring.push(ring[0])
  }

  const width = nodeWidth(tree.root, pxPerWeight)
  return ringFeature<RibbonProperties>(ring, { color, width, key, opacity: 1 })
}

// --- Compilation: coordinate split→merge junction offsets ---

/** Key for position matching (rounded to avoid float issues) */
function posKey(pos: LatLon): string {
  return `${pos[0].toFixed(6)},${pos[1].toFixed(6)}`
}

/** Info about a merge junction slot for a specific child */
interface JunctionSlot {
  offset: LatLon  // the offset junction point
  bearing: number // the merge bearing (arrival direction)
}

/** Build a map of merge positions → per-child junction offsets.
 *  For each merge, computes the perpendicular offset for each child
 *  based on its position in the stacking order. The map is keyed by
 *  the child's source position (so a split branch targeting that
 *  position can look up its correct offset). */
function buildJunctionMap(
  trees: FlowTree[],
  opts: RenderFlowTreeOpts,
): Map<string, JunctionSlot> {
  const { refLat, zoom, geoScale, pxPerWeight } = opts
  const junctionMap = new Map<string, JunctionSlot>()

  function walk(node: FlowNode) {
    if (node.type !== 'merge') {
      if (node.type === 'split') node.children.forEach(walk)
      return
    }
    const [perpLat, perpLon] = bearingPerpLeft(node.bearing)
    const ls = lngScale(refLat)
    const totalNodeW = nodeWidth(node, pxPerWeight)
    const hw = pxToHalfDeg(totalNodeW, zoom, geoScale, refLat)

    // User-specified order (same as renderNode — no auto-sort)
    const childIndices = node.children.map((_, i) => i)

    const childWidths = childIndices.map(i => nodeWidth(node.children[i], pxPerWeight))
    const totalW = childWidths.reduce((s, w) => s + w, 0)
    let cumW = 0
    for (let ci = 0; ci < childIndices.length; ci++) {
      const cw = childWidths[ci]
      const centerOffset = -totalW / 2 + cumW + cw / 2
      cumW += cw
      const offsetDeg = pxToDeg(centerOffset, zoom, geoScale, refLat)
      const junctionPt: LatLon = [
        node.pos[0] + perpLat * offsetDeg,
        node.pos[1] + perpLon * offsetDeg * ls,
      ]
      const child = node.children[childIndices[ci]]
      // Map child's source position → its junction offset at this merge
      junctionMap.set(posKey(child.pos), {
        offset: junctionPt,
        bearing: node.bearing,
      })
      // Recurse into child subtrees
      walk(child)
    }
  }

  for (const tree of trees) walk(tree.root)
  return junctionMap
}

/** Render multiple flow trees, returning a GeoJSON FeatureCollection.
 *  Performs a compilation pass first to coordinate split→merge offsets.
 *  When `singlePoly` is true, each tree is rendered as a single polygon
 *  (no seams at junctions). */
export function renderFlows(
  trees: FlowTree[],
  opts: RenderFlowTreeOpts & { singlePoly?: boolean },
): GeoJSON.FeatureCollection {
  // Compilation: build junction offset map from all merges
  const junctionMap = buildJunctionMap(trees, opts)

  const features: GeoJSON.Feature[] = []
  for (const tree of trees) {
    if (opts.singlePoly) {
      features.push(renderFlowTreeSinglePoly(tree, opts, junctionMap))
    } else {
      features.push(...renderFlowTree(tree, opts, junctionMap))
    }
  }
  features.sort((a, b) => ((b.properties?.width as number) ?? 0) - ((a.properties?.width as number) ?? 0))
  return { type: 'FeatureCollection', features }
}
