import { useMemo, useCallback } from 'react'
import MapGL, { Source, Layer } from 'react-map-gl/maplibre'
import { useUrlState } from 'use-prms'
import type { Param } from 'use-prms'
import { cubicBezier, directedBezier, ribbon, ringFeature, pxToDeg, perpAt, renderFlows } from 'geo-sankey'
import type { LatLon, FlowTree } from 'geo-sankey'
import { useLLZ } from '../llz'
import { useTheme, MAP_STYLES } from '../App'
import 'maplibre-gl/dist/maplibre-gl.css'

// --- Scenario types ---

type Scenario = {
  id: string
  label: string
  group: string
  description: string
  makeFeatures: (zoom: number, n: number) => GeoJSON.FeatureCollection
}

// --- Constants ---

const COLOR = '#d32f2f'
const CENTER_LON = -74.035
const CENTER_LAT = 40.730
const REF_LAT = 40.730
const RIBBON_PX = 12

// --- Rectangle scenarios ---

function rectFeatures(gapDeg: number, single: boolean): GeoJSON.FeatureCollection {
  const hw = 0.005, hh = 0.002
  const l = CENTER_LON - hw, r = CENTER_LON + hw
  const t = CENTER_LAT + hh, b = CENTER_LAT - hh
  const m = CENTER_LON

  if (single) {
    return fc([feat([[l, t], [r, t], [r, b], [l, b], [l, t]])])
  }
  return fc([
    feat([[l, t], [m, t], [m, b], [l, b], [l, t]]),
    feat([[m + gapDeg, t], [r, t], [r, b], [m + gapDeg, b], [m + gapDeg, t]]),
  ])
}

// --- Bezier ribbon junction scenarios ---

function straightLine(start: LatLon, end: LatLon, n = 20): LatLon[] {
  const pts: LatLon[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    pts.push([start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t])
  }
  return pts
}

/** Build a single 2-ribbon junction at a given center position.
 *  Returns left path and right path. */
function makeJunction(
  center: LatLon, leftCPs: [LatLon, LatLon], rightCPs: [LatLon, LatLon],
  leftStart: LatLon, rightEnd: LatLon, n: number,
): { leftPath: LatLon[]; rightPath: LatLon[]; leftCP2: LatLon; rightCP1: LatLon } {
  const leftPath = cubicBezier(leftStart, leftCPs[0], leftCPs[1], center, n)
  const rightPath = cubicBezier(center, rightCPs[0], rightCPs[1], rightEnd, n)
  return { leftPath, rightPath, leftCP2: leftCPs[1], rightCP1: rightCPs[0] }
}

/** Apply Step 2 (exact end-bearing) to a junction's paths. */
function applyExactBearing(
  leftPath: LatLon[], rightPath: LatLon[],
  junc: LatLon, leftCP2: LatLon, rightCP1: LatLon,
) {
  const segLen = 0.00003
  const lDir = [junc[0] - leftCP2[0], junc[1] - leftCP2[1]]
  const lLen = Math.sqrt(lDir[0] ** 2 + lDir[1] ** 2)
  if (lLen > 0) {
    leftPath[leftPath.length - 1] = [junc[0] - lDir[0] / lLen * segLen, junc[1] - lDir[1] / lLen * segLen]
    leftPath.push([...junc] as LatLon)
  }
  const rDir = [rightCP1[0] - junc[0], rightCP1[1] - junc[1]]
  const rLen = Math.sqrt(rDir[0] ** 2 + rDir[1] ** 2)
  if (rLen > 0) {
    rightPath[0] = [junc[0] + rDir[0] / rLen * segLen, junc[1] + rDir[1] / rLen * segLen]
    rightPath.unshift([...junc] as LatLon)
  }
}

/** Apply Step 3 (miter join) to two ribbon rings. */
function applyMiterJoin(leftRing: [number, number][], rightRing: [number, number][], ln: number, rn: number) {
  const mL = lineIntersection(leftRing[ln - 2], leftRing[ln - 1], rightRing[0], rightRing[1])
  const mR = lineIntersection(leftRing[ln + 1], leftRing[ln], rightRing[2 * rn - 1], rightRing[2 * rn - 2])
  if (mL && mR) {
    leftRing[ln - 1] = mL; leftRing[ln] = mR
    rightRing[0] = mL; rightRing[2 * rn - 1] = mR
    leftRing[leftRing.length - 1] = leftRing[0]
    rightRing[rightRing.length - 1] = rightRing[0]
  }
}

/** Three junction geometries shown simultaneously, all with the selected fix mode. */
function junctionFeatures(zoom: number, n: number, opts: {
  sharedVertices?: boolean
  exactBearing?: boolean
}): GeoJSON.FeatureCollection {
  const halfW = pxToDeg(RIBBON_PX, zoom, 1, REF_LAT) / 2
  const features: GeoJSON.Feature[] = []
  const d = 0.008 // spacing between junctions

  // Junction 1 (top): bezier → straight line
  const j1: LatLon = [CENTER_LAT + d, CENTER_LON]
  const j1Left = makeJunction(j1,
    [[j1[0] + 0.004, j1[1] - 0.004], [j1[0], j1[1] - 0.004]], // convex from NW
    [[j1[0], j1[1] + 0.001], [j1[0], j1[1] + 0.001]],          // ~straight east (degenerate bezier)
    [j1[0] + 0.005, j1[1] - 0.010] as LatLon,
    [j1[0], j1[1] + 0.010] as LatLon, n,
  )

  // Junction 2 (middle): bezier → S-curve
  const j2: LatLon = [CENTER_LAT, CENTER_LON]
  const j2Left = makeJunction(j2,
    [[j2[0] + 0.005, j2[1] - 0.004], [j2[0], j2[1] - 0.005]],
    [[j2[0], j2[1] + 0.005], [j2[0] - 0.005, j2[1] + 0.005]],
    [j2[0] + 0.005, j2[1] - 0.010] as LatLon,
    [j2[0] - 0.005, j2[1] + 0.010] as LatLon, n,
  )

  // Junction 3 (bottom): sharp angle bezier → bezier
  const j3: LatLon = [CENTER_LAT - d, CENTER_LON]
  const j3Left = makeJunction(j3,
    [[j3[0] + 0.006, j3[1] - 0.002], [j3[0] + 0.002, j3[1] - 0.003]],
    [[j3[0] - 0.002, j3[1] + 0.003], [j3[0] - 0.006, j3[1] + 0.002]],
    [j3[0] + 0.006, j3[1] - 0.010] as LatLon,
    [j3[0] - 0.006, j3[1] + 0.010] as LatLon, n,
  )

  for (const junc of [j1Left, j2Left, j3Left]) {
    let { leftPath, rightPath, leftCP2, rightCP1 } = junc
    const center = leftPath[leftPath.length - 1]

    if (opts.exactBearing) {
      applyExactBearing(leftPath, rightPath, center, leftCP2, rightCP1)
    }

    const leftRing = ribbon(leftPath, halfW, REF_LAT)
    const rightRing = ribbon(rightPath, halfW, REF_LAT)

    if (opts.sharedVertices) {
      applyMiterJoin(leftRing, rightRing, leftPath.length, rightPath.length)
    }

    features.push(ringFeature(leftRing, { color: COLOR }))
    features.push(ringFeature(rightRing, { color: COLOR }))
  }

  return fc(features)
}

/** Two-child merge using the library's renderFlows. */
function mergeFeatures(zoom: number, opts: {
  singlePoly?: boolean
}): GeoJSON.FeatureCollection {
  const tree: FlowTree = {
    dest: 'dest',
    destPos: [CENTER_LAT, CENTER_LON + 0.012],
    root: {
      type: 'merge',
      pos: [CENTER_LAT, CENTER_LON],
      bearing: 90,
      children: [
        { type: 'source', label: 'C2', pos: [CENTER_LAT - 0.005, CENTER_LON - 0.012], weight: 50 },
        { type: 'source', label: 'C1', pos: [CENTER_LAT + 0.005, CENTER_LON - 0.012], weight: 50 },
      ],
    },
  }
  return renderFlows([tree], {
    refLat: REF_LAT,
    zoom,
    geoScale: 1,
    color: COLOR,
    key: 'merge-test',
    pxPerWeight: () => RIBBON_PX,
    arrowWing: 1.8,
    arrowLen: 1.2,
    singlePoly: opts.singlePoly,
  })
}

// --- Helpers ---

/** Line-line intersection of segments p1→p2 and p3→p4 (extended to infinite lines). */
function lineIntersection(
  p1: [number, number], p2: [number, number],
  p3: [number, number], p4: [number, number],
): [number, number] | null {
  const d1x = p2[0] - p1[0], d1y = p2[1] - p1[1]
  const d2x = p4[0] - p3[0], d2y = p4[1] - p3[1]
  const denom = d1x * d2y - d1y * d2x
  if (Math.abs(denom) < 1e-15) return null // parallel
  const t = ((p3[0] - p1[0]) * d2y - (p3[1] - p1[1]) * d2x) / denom
  return [p1[0] + t * d1x, p1[1] + t * d1y]
}

function feat(coords: [number, number][]): GeoJSON.Feature {
  return { type: 'Feature', properties: { color: COLOR }, geometry: { type: 'Polygon', coordinates: [coords] } }
}

function fc(features: GeoJSON.Feature[]): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features }
}

// --- All scenarios (opacity is now separate) ---

const scenarios: Scenario[] = [
  // Group 1: Simple rectangles
  { id: 'rect-exact', label: 'Shared vertices', group: 'Rectangles',
    description: 'Two rectangles sharing exact edge coordinates. At opacity 1.0: no seam. At opacity <1: alpha overlap produces a darker line.',
    makeFeatures: () => rectFeatures(0, false) },
  { id: 'rect-gap', label: 'Sub-pixel gap', group: 'Rectangles',
    description: 'Sub-pixel gap (~0.3px) between polygons. Background bleeds through even at full opacity.',
    makeFeatures: () => rectFeatures(0.00002, false) },
  { id: 'rect-overlap', label: 'Sub-pixel overlap', group: 'Rectangles',
    description: 'Sub-pixel overlap (negative gap). At opacity 1.0: no seam. At opacity <1: darker line from double alpha.',
    makeFeatures: () => rectFeatures(-0.00002, false) },
  { id: 'rect-single', label: 'Single polygon', group: 'Rectangles',
    description: 'Both halves as one polygon. No seam at any opacity.',
    makeFeatures: () => rectFeatures(0, true) },

  // Group 2: Bezier ribbon junctions (two beziers meeting at a point)
  { id: 'bzr-default', label: 'Default', group: 'Bezier junction',
    description: 'Two bezier ribbons meeting at a junction. Left: convex curve. Right: S-curve. BPL sampling causes perpendicular mismatch at junction.',
    makeFeatures: (z, n) => junctionFeatures(z, n, {}) },
  { id: 'bzr-shared', label: 'Miter join (Step 3)', group: 'Bezier junction',
    description: 'Edge-intersection miter join at junction. Both polygons trimmed to shared edge. Eliminates gap/overlap.',
    makeFeatures: (z, n) => junctionFeatures(z, n, { sharedVertices: true }) },
  { id: 'bzr-bearing', label: 'Exact bearing (Step 2)', group: 'Bezier junction',
    description: 'Short exact-bearing segments appended at junction. Perpendicular directions match — near-zero gap.',
    makeFeatures: (z, n) => junctionFeatures(z, n, { exactBearing: true }) },
  { id: 'bzr-both', label: 'Steps 2+3', group: 'Bezier junction',
    description: 'Both exact end-bearing and miter join. Best multi-polygon result.',
    makeFeatures: (z, n) => junctionFeatures(z, n, { exactBearing: true, sharedVertices: true }) },

  // Group 3: Two-child merge
  { id: 'merge-multi', label: 'Multi-polygon', group: '2-child merge',
    description: 'Two children merge into trunk. Three separate polygons — seams visible at junction (especially at low opacity).',
    makeFeatures: (z) => mergeFeatures(z, {}) },
  { id: 'merge-single', label: 'Single polygon', group: '2-child merge',
    description: 'Entire merge rendered as one stitched polygon (Step 5). No internal seams at any opacity.',
    makeFeatures: (z) => mergeFeatures(z, { singlePoly: true }) },
]

const DEFAULTS = { lat: CENTER_LAT, lng: CENTER_LON, zoom: 15 }

export default function SeamTest() {
  const [llz, setLLZ] = useLLZ(DEFAULTS)
  const scenarioParam: Param<string> = {
    encode: (v) => v === scenarios[0].id ? undefined : v,
    decode: (s) => s && scenarios.some(sc => sc.id === s) ? s : scenarios[0].id,
  }
  const opacityParam: Param<number> = {
    encode: (v) => v === 0.5 ? undefined : v.toFixed(2),
    decode: (s) => s ? parseFloat(s) || 0.5 : 0.5,
  }
  const nParam: Param<number> = {
    encode: (v) => v === 20 ? undefined : String(v),
    decode: (s) => s ? parseInt(s) || 20 : 20,
  }
  const [activeId, setActiveId] = useUrlState('s', scenarioParam)
  const [opacity, setOpacity] = useUrlState('o', opacityParam)
  const [bplN, setBplN] = useUrlState('n', nParam)
  const scenario = scenarios.find(s => s.id === activeId)!

  const geojson = useMemo(() => scenario.makeFeatures(llz.zoom, bplN), [scenario, llz.zoom, bplN])

  const onMove = useCallback((e: { viewState: { longitude: number; latitude: number; zoom: number } }) => {
    setLLZ({ lat: e.viewState.latitude, lng: e.viewState.longitude, zoom: e.viewState.zoom })
  }, [setLLZ])

  const groups = [...new Set(scenarios.map(s => s.group))]

  return (
    <div className="example">
      <h2>Polygon Seam Test</h2>
      <p>
        Adjacent polygon rendering in MapLibre GL JS. Tests whether polygons sharing edges
        produce visible seams. Relevant to flow-ribbon junction rendering where branches meet trunks.
      </p>
      {groups.map(group => (
        <div key={group} style={{ marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: '#888', marginRight: 6 }}>{group}:</span>
          {scenarios.filter(s => s.group === group).map(s => (
            <button
              key={s.id}
              onClick={() => setActiveId(s.id)}
              style={{
                fontSize: 11, padding: '3px 8px', marginRight: 4, marginBottom: 2,
                background: s.id === activeId ? '#222' : '#fff',
                color: s.id === activeId ? '#fff' : '#222',
                border: '1px solid #999',
                borderRadius: 3,
                cursor: 'pointer',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '6px 0', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, color: '#555' }}>Opacity:</label>
          <input
            type="range" min="0.1" max="1" step="0.05"
            value={opacity}
            onChange={e => setOpacity(parseFloat(e.target.value))}
            style={{ width: 120 }}
          />
          <span style={{ fontSize: 12, color: '#555', minWidth: 28 }}>{opacity.toFixed(2)}</span>
        </div>
        {scenario.group === 'Bezier junction' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, color: '#555' }}>BPL segments:</label>
            <input
              type="range" min="3" max="60" step="1"
              value={bplN}
              onChange={e => setBplN(parseInt(e.target.value))}
              style={{ width: 120 }}
            />
            <span style={{ fontSize: 12, color: '#555', minWidth: 20 }}>{bplN}</span>
          </div>
        )}
      </div>
      <p style={{ fontSize: 12, color: '#555', margin: '4px 0 8px', maxHeight: 36, overflow: 'hidden' }}>
        {scenario.description}
      </p>
      <div className="map-container">
        <MapGL
          initialViewState={{ longitude: llz.lng, latitude: llz.lat, zoom: llz.zoom }}
          style={{ width: '100%', height: '100%' }}
          mapStyle={MAP_STYLES[useTheme().theme]}
          onMove={onMove}
        >
          <Source id="seam-test" type="geojson" data={geojson}>
            <Layer
              id="seam-fill"
              type="fill"
              paint={{ 'fill-color': ['get', 'color'], 'fill-opacity': opacity }}
            />
          </Source>
        </MapGL>
      </div>
    </div>
  )
}
