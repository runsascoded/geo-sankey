import { describe, it, expect } from 'vitest'
import { renderFlowGraph, renderFlowGraphSinglePoly } from '../graph'
import type { FlowGraph, FlowGraphOpts } from '../graph'

const REF_LAT = 40.735
const defaultOpts: FlowGraphOpts = {
  refLat: REF_LAT,
  zoom: 14,
  color: '#000',
  pxPerWeight: 0.3,
}

/** Extract ring coordinates from the first polygon feature */
function getRing(fc: GeoJSON.FeatureCollection): [number, number][] {
  const f = fc.features[0]
  if (!f) return []
  return (f.geometry as GeoJSON.Polygon).coordinates[0] as [number, number][]
}

/** Check that a ring is closed (last point = first point) */
function isClosed(ring: [number, number][]): boolean {
  if (ring.length < 3) return false
  return ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
}

/** Check that no two consecutive segments cross (simple self-intersection test).
 *  Returns the index of the first crossing, or -1 if none. */
function findSelfIntersection(ring: [number, number][]): number {
  const n = ring.length - 1 // skip closing point
  for (let i = 0; i < n - 2; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue // skip adjacent start/end
      if (segmentsIntersect(ring[i], ring[i + 1], ring[j], ring[j + 1])) {
        return i
      }
    }
  }
  return -1
}

function segmentsIntersect(
  a1: [number, number], a2: [number, number],
  b1: [number, number], b2: [number, number],
): boolean {
  const d1x = a2[0] - a1[0], d1y = a2[1] - a1[1]
  const d2x = b2[0] - b1[0], d2y = b2[1] - b1[1]
  const denom = d1x * d2y - d1y * d2x
  if (Math.abs(denom) < 1e-15) return false // parallel
  const t = ((b1[0] - a1[0]) * d2y - (b1[1] - a1[1]) * d2x) / denom
  const u = ((b1[0] - a1[0]) * d1y - (b1[1] - a1[1]) * d1x) / denom
  return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999
}

// --- Test graphs ---

const singleEdge: FlowGraph = {
  nodes: [
    { id: 'a', pos: [40.735, -74.040], bearing: 90 },
    { id: 'b', pos: [40.735, -74.020], bearing: 90 },
  ],
  edges: [
    { from: 'a', to: 'b', weight: 30 },
  ],
}

const simpleMerge: FlowGraph = {
  nodes: [
    { id: 'n1', pos: [40.740, -74.035], bearing: 150 },
    { id: 'n2', pos: [40.730, -74.035], bearing: 30 },
    { id: 'merge', pos: [40.735, -74.025], bearing: 90 },
    { id: 'dest', pos: [40.735, -74.010], bearing: 90 },
  ],
  edges: [
    { from: 'n1', to: 'merge', weight: 20 },
    { from: 'n2', to: 'merge', weight: 20 },
    { from: 'merge', to: 'dest', weight: 40 },
  ],
}

const simpleSplit: FlowGraph = {
  nodes: [
    { id: 'src', pos: [40.735, -74.050], bearing: 90 },
    { id: 'split', pos: [40.735, -74.040], bearing: 90 },
    { id: 'd1', pos: [40.745, -74.020], bearing: 90 },
    { id: 'd2', pos: [40.725, -74.020], bearing: 90 },
  ],
  edges: [
    { from: 'src', to: 'split', weight: 30 },
    { from: 'split', to: 'd1', weight: 15 },
    { from: 'split', to: 'd2', weight: 15 },
  ],
}

const ferryGraph: FlowGraph = {
  nodes: [
    { id: 'origin', pos: [40.735, -74.055], bearing: 90 },
    { id: 'split', pos: [40.735, -74.045], bearing: 90 },
    { id: 'merge', pos: [40.735, -74.020], bearing: 90 },
    { id: 'dest', pos: [40.735, -74.000], bearing: 90 },
    { id: 'north', pos: [40.748, -74.038], bearing: 150 },
    { id: 'south', pos: [40.720, -74.038], bearing: 30 },
  ],
  edges: [
    { from: 'origin', to: 'split', weight: 35 },
    { from: 'split', to: 'merge', weight: 20 },
    { from: 'split', to: 'south', weight: 15 },
    { from: 'north', to: 'merge', weight: 30 },
    { from: 'merge', to: 'dest', weight: 50 },
  ],
}

// --- Multi-poly tests ---

describe('renderFlowGraph (multi-poly)', () => {
  it('single edge: produces features', () => {
    const fc = renderFlowGraph(singleEdge, defaultOpts)
    expect(fc.features.length).toBeGreaterThan(0)
  })

  it('single edge: all polygons are closed', () => {
    const fc = renderFlowGraph(singleEdge, defaultOpts)
    for (const f of fc.features) {
      const ring = (f.geometry as GeoJSON.Polygon).coordinates[0]
      expect(ring[0]).toEqual(ring[ring.length - 1])
    }
  })

  it('simple merge: produces features for edges + body + arrowhead', () => {
    const fc = renderFlowGraph(simpleMerge, defaultOpts)
    expect(fc.features.length).toBeGreaterThanOrEqual(4) // 3 edges + 1 body + arrow + source trunks
  })

  it('ferry graph: produces features', () => {
    const fc = renderFlowGraph(ferryGraph, defaultOpts)
    expect(fc.features.length).toBeGreaterThan(0)
  })
})

// --- Single-poly tests ---

describe('renderFlowGraphSinglePoly', () => {
  it('single edge: produces exactly 1 feature', () => {
    const fc = renderFlowGraphSinglePoly(singleEdge, defaultOpts)
    expect(fc.features.length).toBe(1)
  })

  it('single edge: ring is closed', () => {
    const fc = renderFlowGraphSinglePoly(singleEdge, defaultOpts)
    const ring = getRing(fc)
    expect(isClosed(ring)).toBe(true)
  })

  it('single edge: ring has no self-intersections', () => {
    const fc = renderFlowGraphSinglePoly(singleEdge, defaultOpts)
    const ring = getRing(fc)
    expect(findSelfIntersection(ring)).toBe(-1)
  })

  it('simple merge: produces exactly 1 feature', () => {
    const fc = renderFlowGraphSinglePoly(simpleMerge, defaultOpts)
    expect(fc.features.length).toBe(1)
  })

  it('simple merge: ring is closed', () => {
    const fc = renderFlowGraphSinglePoly(simpleMerge, defaultOpts)
    const ring = getRing(fc)
    expect(isClosed(ring)).toBe(true)
  })

  it('simple merge: ring has no self-intersections', () => {
    const fc = renderFlowGraphSinglePoly(simpleMerge, defaultOpts)
    const ring = getRing(fc)
    const idx = findSelfIntersection(ring)
    expect(idx).toBe(-1)
  })

  it('simple split: produces exactly 1 feature', () => {
    const fc = renderFlowGraphSinglePoly(simpleSplit, defaultOpts)
    expect(fc.features.length).toBe(1)
  })

  it('simple split: ring is closed', () => {
    const fc = renderFlowGraphSinglePoly(simpleSplit, defaultOpts)
    const ring = getRing(fc)
    expect(isClosed(ring)).toBe(true)
  })

  it('simple split: ring has no self-intersections', () => {
    const fc = renderFlowGraphSinglePoly(simpleSplit, defaultOpts)
    const ring = getRing(fc)
    const idx = findSelfIntersection(ring)
    expect(idx).toBe(-1)
  })

  it('ferry graph: produces exactly 1 feature', () => {
    const fc = renderFlowGraphSinglePoly(ferryGraph, defaultOpts)
    expect(fc.features.length).toBe(1)
  })

  it('ferry graph: ring is closed', () => {
    const fc = renderFlowGraphSinglePoly(ferryGraph, defaultOpts)
    const ring = getRing(fc)
    expect(isClosed(ring)).toBe(true)
  })

  it('ferry graph: ring has no self-intersections', () => {
    const fc = renderFlowGraphSinglePoly(ferryGraph, defaultOpts)
    const ring = getRing(fc)
    const idx = findSelfIntersection(ring)
    if (idx !== -1) {
      console.log(`Self-intersection at ring index ${idx}, points:`, ring[idx], ring[idx + 1])
    }
    expect(idx).toBe(-1)
  })

  it('single edge: ring points are all finite', () => {
    const fc = renderFlowGraphSinglePoly(singleEdge, defaultOpts)
    const ring = getRing(fc)
    for (const [lon, lat] of ring) {
      expect(Number.isFinite(lon)).toBe(true)
      expect(Number.isFinite(lat)).toBe(true)
    }
  })

  it('ferry graph: ring points are all within reasonable bounds', () => {
    const fc = renderFlowGraphSinglePoly(ferryGraph, defaultOpts)
    const ring = getRing(fc)
    for (const [lon, lat] of ring) {
      expect(lon).toBeGreaterThan(-75)
      expect(lon).toBeLessThan(-73)
      expect(lat).toBeGreaterThan(40)
      expect(lat).toBeLessThan(41)
    }
  })
})
