import { describe, it, expect } from 'vitest'
import { renderFlowGraph, type FlowGraph, type FlowGraphOpts } from '../../src/index'

const graph: FlowGraph = {
  nodes: [
    { id: 'a', pos: [40.735, -74.05] },
    { id: 'b', pos: [40.735, -74.00] },
  ],
  edges: [{ from: 'a', to: 'b', weight: 10 }],
}

const baseOpts: FlowGraphOpts = {
  refLat: 40.735, zoom: 13, geoScale: 1,
  pxPerWeight: 1, color: '#fff',
}

function ribbonWidthPx(fc: GeoJSON.FeatureCollection): number {
  const f = fc.features.find(x => x.properties?.from === 'a' && x.properties?.to === 'b')!
  return (f.properties as any).width
}

describe('mPerWeight', () => {
  it('overrides pxPerWeight when set', () => {
    const px1 = ribbonWidthPx(renderFlowGraph(graph, baseOpts))
    // mPerWeight should yield a different (zoom-dependent) effective px width
    const wMeters = ribbonWidthPx(renderFlowGraph(graph, { ...baseOpts, mPerWeight: 5 }))
    expect(wMeters).not.toBe(px1)
    expect(wMeters).toBeGreaterThan(0)
  })

  it('doubles ribbon width when zoom increases by 1', () => {
    const wZ13 = ribbonWidthPx(renderFlowGraph(graph, { ...baseOpts, mPerWeight: 5, zoom: 13 }))
    const wZ14 = ribbonWidthPx(renderFlowGraph(graph, { ...baseOpts, mPerWeight: 5, zoom: 14 }))
    // Web mercator: each zoom level doubles px-per-meter.
    expect(wZ14 / wZ13).toBeCloseTo(2, 3)
  })

  it('width scales linearly with mPerWeight', () => {
    const w1 = ribbonWidthPx(renderFlowGraph(graph, { ...baseOpts, mPerWeight: 5 }))
    const w2 = ribbonWidthPx(renderFlowGraph(graph, { ...baseOpts, mPerWeight: 10 }))
    expect(w2 / w1).toBeCloseTo(2, 5)
  })

  it('falls back to pxPerWeight when mPerWeight is undefined', () => {
    const w = ribbonWidthPx(renderFlowGraph(graph, { ...baseOpts, pxPerWeight: 3 }))
    // weight 10 × pxPerWeight 3 = 30
    expect(w).toBe(30)
  })
})
