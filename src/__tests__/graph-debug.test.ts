import { describe, it } from 'vitest'
import { renderFlowGraphSinglePoly } from '../graph'
import type { FlowGraph, FlowGraphOpts } from '../graph'

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

const opts: FlowGraphOpts = {
  refLat: 40.735,
  zoom: 14,
  color: '#000',
  pxPerWeight: 0.3,
}

describe('ferry graph ring debug', () => {
  it('dump ring points around intersection', async () => {
    // @ts-ignore
    const fs = await import('node:fs');
    const fc = renderFlowGraphSinglePoly(ferryGraph, opts)
    const ring = (fc.features[0].geometry as GeoJSON.Polygon).coordinates[0] as [number, number][]
    const lines = [`Ring has ${ring.length} points`]
    for (let i = 0; i < ring.length; i++) {
      const [lon, lat] = ring[i]
      lines.push(`[${i}] lon=${lon.toFixed(6)} lat=${lat.toFixed(6)}`)
    }
    fs.writeFileSync('tmp/ring-debug.txt', lines.join('\n'))

    // Also dump slot positions and halfW values
    const { pxToHalfDeg, pxToDeg, lngScale } = await import('../../src/geo')
    const refLat = 40.735, zoom = 14, geoScale = 1
    const pxPW = 0.3
    const lines2: string[] = []
    lines2.push(`lngScale(${refLat}) = ${lngScale(refLat)}`)
    lines2.push(`pxToDeg(1, 14, 1, ${refLat}) = ${pxToDeg(1, zoom, geoScale, refLat)}`)
    for (const w of [15, 20, 30, 35, 50]) {
      const px = w * pxPW
      const hw = pxToHalfDeg(px, zoom, geoScale, refLat)
      lines2.push(`weight=${w}: px=${px}, halfW=${hw.toFixed(8)} deg`)
    }
    fs.writeFileSync('tmp/slot-debug.txt', lines2.join('\n'))
  })
})
