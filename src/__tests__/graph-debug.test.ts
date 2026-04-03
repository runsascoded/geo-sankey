import { describe, it } from 'vitest'
import { renderFlowGraphSinglePoly } from '../graph'
import type { FlowGraph, FlowGraphOpts } from '../graph'

const simpleMerge: FlowGraph = {
  nodes: [
    { id: 'n1', pos: [40.745, -74.040], bearing: 150 },
    { id: 'n2', pos: [40.725, -74.040], bearing: 30 },
    { id: 'merge', pos: [40.735, -74.025], bearing: 90 },
    { id: 'dest', pos: [40.735, -74.005], bearing: 90 },
  ],
  edges: [
    { from: 'n1', to: 'merge', weight: 20 },
    { from: 'n2', to: 'merge', weight: 20 },
    { from: 'merge', to: 'dest', weight: 40 },
  ],
}

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

describe('ring debug', () => {
  it('simple ferry full dump', async () => {
    // @ts-ignore
    const fs = await import('node:fs')
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
    const fc = renderFlowGraphSinglePoly(ferryGraph, opts)
    const ring = (fc.features[0].geometry as GeoJSON.Polygon).coordinates[0] as [number, number][]
    // Find the merge area (lon ≈ -74.020) and annotate
    const lines = [`Ring: ${ring.length} points`]
    for (let i = 0; i < ring.length; i++) {
      const [lon, lat] = ring[i]
      const prev = i > 0 ? ring[i-1] : null
      const latJump = prev ? Math.abs(lat - prev[1]) : 0
      const marker = latJump > 0.001 ? ' *** LAT JUMP' : ''
      lines.push(`[${i}] lon=${lon.toFixed(6)} lat=${lat.toFixed(6)}${marker}`)
    }
    fs.writeFileSync('tmp/ferry-ring.txt', lines.join('\n'))

    // Also check edge pair sizes
    const { pxToHalfDeg } = await import('../../src/geo')
    const edgeInfo: string[] = []
    for (const e of ferryGraph.edges) {
      edgeInfo.push(`${e.from}→${e.to}: weight=${e.weight}`)
    }
    fs.writeFileSync('tmp/ferry-edges.txt', edgeInfo.join('\n'))

    // Check specific edge pair endpoints
    // The merge→dest edge LEFT should end near the dest arrowhead LEFT start
    // Access internals by re-running computeLayout
    const { computeLayout: cl } = await import('../../src/graph') as any
    // Can't easily access internals. Just dump ring sections.
    // Mark every 20th point to estimate which edge it belongs to
    const sectLines = [`Ring sections (every 21 pts ≈ 1 bezier):`]
    for (let i = 0; i < ring.length; i += 21) {
      sectLines.push(`[${i}] lon=${ring[i][0].toFixed(4)} lat=${ring[i][1].toFixed(4)}`)
    }
    fs.writeFileSync('tmp/ferry-sections.txt', sectLines.join('\n'))
  })

  it('HBT ferry ring dump', async () => {
    // Use same wider positions as the test
    hbtFerry.nodes = [
      { id: 'hob-so', pos: [40.7359, -74.0320], bearing: 90 },
      { id: 'hob-14', pos: [40.7520, -74.0280], bearing: 90 },
      { id: 'whk', pos: [40.7771, -74.0160], bearing: 130 },
      { id: 'ph', pos: [40.7100, -74.0380], bearing: 60 },
      { id: 'hob-split', pos: [40.7359, -74.0240], bearing: 90 },
      { id: 'ut-merge', pos: [40.7530, -74.0190], bearing: 30 },
      { id: 'dt-merge', pos: [40.7100, -74.0240], bearing: 90 },
      { id: 'mt-merge', pos: [40.7590, -74.0080], bearing: 110 },
      { id: 'mt39', pos: [40.7570, -73.9980], bearing: 110 },
      { id: 'bpt', pos: [40.7100, -74.0140], bearing: 90 },
    ]
    // @ts-ignore
    const fs = await import('node:fs')
    const fc = renderFlowGraphSinglePoly(hbtFerry, opts)
    const ring = (fc.features[0].geometry as GeoJSON.Polygon).coordinates[0] as [number, number][]
    const lines = [`Ring has ${ring.length} points`]
    // Dump around the crossing segments [56-57] and [91-92]
    for (let i = Math.max(0, 200); i < Math.min(ring.length, 225); i++) {
      const [lon, lat] = ring[i]
      lines.push(`[${i}] lon=${lon.toFixed(6)} lat=${lat.toFixed(6)}`)
    }
    fs.writeFileSync('tmp/hbt-ring-debug.txt', lines.join('\n'))

    // Dump bpt face corners
    // Access layout via re-running... just check ring points
    const bptInfo = `bpt node: [40.7100, -74.0140], bearing 90
Points near bpt (lon ≈ -74.014 to -74.021):
${ring.filter(([lon]) => lon > -74.022 && lon < -74.013).map((p, i) => `  [${ring.indexOf(p)}] lon=${p[0].toFixed(6)} lat=${p[1].toFixed(6)}`).join('\n')}`
    fs.writeFileSync('tmp/hbt-bpt-debug.txt', bptInfo)
  })
})

describe('edge endpoint alignment', () => {
  it('through-node: first input LEFT end = first output LEFT start', async () => {
    // @ts-ignore
    const fs = await import('node:fs')
    const { renderFlowGraphSinglePoly } = await import('../graph')
    
    // Simple merge: n1 + n2 → merge → dest
    const graph = {
      nodes: [
        { id: 'n1', pos: [40.745, -74.040] as [number,number], bearing: 150 },
        { id: 'n2', pos: [40.725, -74.040] as [number,number], bearing: 30 },
        { id: 'merge', pos: [40.735, -74.025] as [number,number], bearing: 90 },
        { id: 'dest', pos: [40.735, -74.005] as [number,number], bearing: 90 },
      ],
      edges: [
        { from: 'n1', to: 'merge', weight: 20 },
        { from: 'n2', to: 'merge', weight: 20 },
        { from: 'merge', to: 'dest', weight: 40 },
      ],
    }
    
    const fc = renderFlowGraphSinglePoly(graph, { refLat: 40.735, zoom: 14, color: '#000', pxPerWeight: 0.3 })
    const ring = (fc.features[0].geometry as any).coordinates[0] as [number,number][]
    
    // Find consecutive lat jumps (boundary transitions)
    const jumps: { idx: number, from: number, to: number, dLat: number }[] = []
    for (let i = 0; i < ring.length - 1; i++) {
      const dLat = Math.abs(ring[i+1][1] - ring[i][1])
      if (dLat > 0.0005) {
        jumps.push({ idx: i, from: ring[i][1], to: ring[i+1][1], dLat })
      }
    }
    
    const lines = [`Ring: ${ring.length} points, ${jumps.length} lat jumps:`]
    for (const j of jumps) {
      lines.push(`  [${j.idx}→${j.idx+1}] lat ${j.from.toFixed(6)} → ${j.to.toFixed(6)} (Δ${j.dLat.toFixed(6)})`)
    }
    fs.writeFileSync('tmp/endpoint-alignment.txt', lines.join('\n'))
  })
})
