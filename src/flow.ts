import type { LatLon, FlowNode, FlowTree, RibbonProperties } from './types'
import { lngScale, pxToHalfDeg, pxToDeg } from './geo'
import { directedBezier, bearingPerpLeft } from './path'
import { ribbon, ribbonArrow, ringFeature } from './ribbon'
import type { RibbonArrowOpts } from './ribbon'

const { cos, sin, PI } = Math

/** Get the representative position of a node (for sorting). */
function childPos(node: FlowNode): LatLon {
  return node.pos
}

/** Compute the total weight of a flow tree node. */
export function nodeWeight(node: FlowNode): number {
  return node.type === 'source'
    ? node.weight
    : node.children.reduce((s, c) => s + nodeWeight(c), 0)
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
}

/** Compute pixel width for a node. For merge nodes, width is the exact sum
 *  of children widths (not independently computed from total weight) to
 *  ensure seamless tiling at junctions. */
export function nodeWidth(node: FlowNode, pxPerWeight: (w: number) => number): number {
  if (node.type === 'source') return pxPerWeight(node.weight)
  return node.children.reduce((s, c) => s + nodeWidth(c, pxPerWeight), 0)
}

/** Render a single flow tree, returning GeoJSON polygon features. */
export function renderFlowTree(tree: FlowTree, opts: RenderFlowTreeOpts): GeoJSON.Feature[] {
  const features: GeoJSON.Feature[] = []
  const { refLat, zoom, geoScale, color, key, pxPerWeight, arrowWing, arrowLen, reverse } = opts

  function renderNode(
    node: FlowNode,
    targetPos: LatLon,
    terminal: boolean,
    arriveBearing?: number,
    straightEnd?: LatLon,
  ) {
    const width = nodeWidth(node, pxPerWeight)
    const hw = pxToHalfDeg(width, zoom, geoScale, refLat)

    let departBearing: number | undefined
    if (node.type === 'merge') {
      departBearing = node.bearing
    } else {
      // Aim departure toward the junction point (or destination for root)
      const aimAt = straightEnd ?? targetPos
      const dLat = aimAt[0] - node.pos[0]
      const dLon = (aimAt[1] - node.pos[1]) * cos(refLat * PI / 180)
      departBearing = Math.atan2(dLon, dLat) * 180 / PI
    }
    let curveStart = node.pos
    const straightStart: LatLon[] = []
    if (node.type === 'merge') {
      const hw2 = pxToHalfDeg(width, zoom, geoScale, refLat)
      const depLen = hw2 * 1.5
      const rad = node.bearing * PI / 180
      const ls = lngScale(refLat)
      curveStart = [node.pos[0] + cos(rad) * depLen, node.pos[1] + sin(rad) * depLen * ls]
      straightStart.push(node.pos)
    }
    const curvePts = directedBezier(curveStart, targetPos, departBearing, arriveBearing)
    let path = [...straightStart, ...curvePts, ...(straightEnd ? [straightEnd] : [])]
    if (reverse) path = [...path].reverse()

    const arrowOpts: RibbonArrowOpts = { arrowWingFactor: arrowWing, arrowLenFactor: arrowLen, widthPx: width }
    const ring = terminal
      ? ribbonArrow(path, hw, refLat, arrowOpts)
      : ribbon(path, hw, refLat)
    if (ring.length) {
      features.push(ringFeature<RibbonProperties>(ring, { color, width, key, opacity: 1 }))
    }

    if (node.type === 'merge') {
      const [perpLat, perpLon] = bearingPerpLeft(node.bearing)
      const ls = lngScale(refLat)

      const rad = node.bearing * PI / 180
      const fwdLat = cos(rad), fwdLon = sin(rad)
      const approachLen = hw * 1.5

      // Sort children by angular position around merge to avoid crossings.
      // Order counterclockwise from -perpLeft direction (bearing + 90°).
      const cosRef = cos(refLat * PI / 180)
      const antiPerpAngle = node.bearing + 90
      const childIndices = node.children.map((_, i) => i)
      childIndices.sort((a, b) => {
        const aPos = childPos(node.children[a])
        const bPos = childPos(node.children[b])
        const aAngle = Math.atan2((aPos[1] - node.pos[1]) * cosRef, aPos[0] - node.pos[0]) * 180 / PI
        const bAngle = Math.atan2((bPos[1] - node.pos[1]) * cosRef, bPos[0] - node.pos[0]) * 180 / PI
        const aCCW = ((aAngle - antiPerpAngle) % 360 + 360) % 360
        const bCCW = ((bAngle - antiPerpAngle) % 360 + 360) % 360
        return aCCW - bCCW
      })

      const childWidths = childIndices.map(i => nodeWidth(node.children[i], pxPerWeight))
      const totalW = childWidths.reduce((s, w) => s + w, 0)
      let cumW = 0
      for (let ci = 0; ci < childIndices.length; ci++) {
        const cw = childWidths[ci]
        const centerOffset = -totalW / 2 + cumW + cw / 2
        cumW += cw
        const offsetDeg = pxToDeg(centerOffset, zoom, geoScale, refLat)
        const childEnd: LatLon = [
          node.pos[0] + perpLat * offsetDeg,
          node.pos[1] + perpLon * offsetDeg * ls,
        ]
        const childApproach: LatLon = [
          childEnd[0] - fwdLat * approachLen,
          childEnd[1] - fwdLon * approachLen * ls,
        ]
        renderNode(node.children[childIndices[ci]], childApproach, false, node.bearing, childEnd)
      }
    }
  }

  renderNode(tree.root, tree.destPos, true)
  return features
}

/** Render multiple flow trees, returning a GeoJSON FeatureCollection. */
export function renderFlows(
  trees: FlowTree[],
  opts: RenderFlowTreeOpts,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  for (const tree of trees) {
    features.push(...renderFlowTree(tree, opts))
  }
  features.sort((a, b) => ((b.properties?.width as number) ?? 0) - ((a.properties?.width as number) ?? 0))
  return { type: 'FeatureCollection', features }
}
