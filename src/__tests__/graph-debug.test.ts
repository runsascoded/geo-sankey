import { describe, it } from 'vitest'
import { renderFlowGraphSinglePoly } from '../graph'
import type { FlowGraph, FlowGraphOpts } from '../graph'

const ferryGraph: FlowGraph = {
  nodes: [
    { id: 'origin', pos: [40.735, -74.045], bearing: 90 },
    { id: 'split', pos: [40.735, -74.040], bearing: 90 },
    { id: 'merge', pos: [40.735, -74.020], bearing: 90 },
    { id: 'dest', pos: [40.735, -74.005], bearing: 90 },
    { id: 'north', pos: [40.745, -74.035], bearing: 150 },
    { id: 'south', pos: [40.725, -74.030], bearing: 30 },
  ],
  edges: [
    { from: 'origin', to: 'split', weight: 35 },
    { from: 'split', to: 'merge', weight: 20 },
    { from: 'split', to: 'south', weight: 15 },
    { from: 'north', to: 'merge', weight: 30 },
    { from: 'merge', to: 'dest', weight: 50 },
  ],
}

const opts: FlowGraphOpts = {
  refLat: 40.735,
  zoom: 14,
  color: '#000',
  pxPerWeight: 0.3,
}

describe('ferry graph ring debug', () => {
  it('dump ring points around intersection', async () => {
    const fs = await import('fs');
    const fc = renderFlowGraphSinglePoly(ferryGraph, opts)
    const ring = (fc.features[0].geometry as GeoJSON.Polygon).coordinates[0] as [number, number][]
    const lines = [`Ring has ${ring.length} points`]
    for (let i = 0; i < ring.length; i++) {
      const [lon, lat] = ring[i]
      lines.push(`[${i}] lon=${lon.toFixed(6)} lat=${lat.toFixed(6)}`)
    }
    fs.writeFileSync('tmp/ring-debug.txt', lines.join('\n'))
  })
})
