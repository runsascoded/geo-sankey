import { describe, it } from 'vitest'
import { renderFlowGraphSinglePoly } from '../graph'
import type { FlowGraph, FlowGraphOpts } from '../graph'

const hbtFerry: FlowGraph = {
  nodes: [
    { id: 'hob-so', pos: [40.7359, -74.0275], bearing: 90 },
    { id: 'hob-14', pos: [40.7505, -74.0241], bearing: 90 },
    { id: 'whk', pos: [40.7771, -74.0136], bearing: 130 },
    { id: 'ph', pos: [40.7138, -74.0337], bearing: 60 },
    { id: 'hob-split', pos: [40.7359, -74.0200], bearing: 90 },
    { id: 'ut-merge', pos: [40.7500, -74.0180], bearing: 30 },
    { id: 'dt-merge', pos: [40.7142, -74.0210], bearing: 90 },
    { id: 'mt-merge', pos: [40.7580, -74.0080], bearing: 110 },
    { id: 'mt39', pos: [40.7555, -74.0060], bearing: 110 },
    { id: 'bpt', pos: [40.7142, -74.0169], bearing: 90 },
  ],
  edges: [
    { from: 'hob-so', to: 'hob-split', weight: 30 },
    { from: 'hob-split', to: 'ut-merge', weight: 15 },
    { from: 'hob-split', to: 'dt-merge', weight: 15 },
    { from: 'hob-14', to: 'ut-merge', weight: 20 },
    { from: 'ut-merge', to: 'mt-merge', weight: 35 },
    { from: 'whk', to: 'mt-merge', weight: 30 },
    { from: 'mt-merge', to: 'mt39', weight: 65 },
    { from: 'ph', to: 'dt-merge', weight: 20 },
    { from: 'dt-merge', to: 'bpt', weight: 35 },
  ],
}

const opts: FlowGraphOpts = { refLat: 40.735, zoom: 14, color: '#000', pxPerWeight: 0.3 }

describe('HBT ferry ring debug', () => {
  it('dump ring around index 47', async () => {
    // @ts-ignore
    const fs = await import('node:fs')
    const fc = renderFlowGraphSinglePoly(hbtFerry, opts)
    const ring = (fc.features[0].geometry as GeoJSON.Polygon).coordinates[0] as [number, number][]
    const lines = [`Ring has ${ring.length} points`]
    for (let i = Math.max(0, 40); i < Math.min(ring.length, 60); i++) {
      const [lon, lat] = ring[i]
      lines.push(`[${i}] lon=${lon.toFixed(6)} lat=${lat.toFixed(6)}`)
    }
    fs.writeFileSync('tmp/hbt-ring-debug.txt', lines.join('\n'))
  })
})
