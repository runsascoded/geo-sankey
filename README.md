# geo-sankey
Width-proportional flow maps

- Supports merges and splits, edges are Bezier polylines
- Outputs GeoJSON — no rendering dependencies, works with any map renderer (MapLibre, Leaflet, deck.gl, etc.).

**Live demo: [geo-sankey.rbw.sh][demo]**

| [NY Waterway][nyw] ferry routes   | Simple Flow with debug overlays        |
|-----------------------------------|----------------------------------------|
| [![HBT Ferry][hbt-img]][hbt-demo] | [![Simple Flow debug][sf-img]][sf-demo] |

## Install

Not on npm yet — install from the `dist` branch:

```bash
pnpm add github:runsascoded/geo-sankey#dist
```

Or pin a specific build SHA: `pnpm add github:runsascoded/geo-sankey#<sha>`.

## Usage

```ts
import { renderFlowGraphSinglePoly, type FlowGraph } from 'geo-sankey'

const graph: FlowGraph = {
  nodes: [
    { id: 'origin',  pos: [40.735, -74.055], bearing: 90, label: 'Origin' },
    { id: 'split',   pos: [40.735, -74.045], bearing: 90 },
    { id: 'merge',   pos: [40.735, -74.020], bearing: 90 },
    { id: 'dest',    pos: [40.735, -74.000], bearing: 90, label: 'Destination' },
    { id: 'north',   pos: [40.748, -74.038], bearing: 150, label: 'North' },
    { id: 'south',   pos: [40.720, -74.038], bearing: 30, label: 'South' },
  ],
  edges: [
    { from: 'origin', to: 'split', weight: 35 },
    { from: 'split', to: 'merge', weight: 20 },
    { from: 'split', to: 'south', weight: 15 },
    { from: 'north', to: 'merge', weight: 30 },
    { from: 'merge', to: 'dest', weight: 'auto' },
  ],
}

const fc = renderFlowGraphSinglePoly(graph, {
  refLat: 40.735,
  zoom: 14,
  color: '#2563eb',
  pxPerWeight: 0.3,
})
// fc is a GeoJSON FeatureCollection<Polygon>
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `pxPerWeight` | — | Pixels per unit weight (controls ribbon width) |
| `mPerWeight` | — | Meters per unit weight (zoom-aware; overrides `pxPerWeight`) |
| `wing` | `0.4` | Arrowhead wing extension (fraction of stem width, per side) |
| `angle` | `45` | Arrowhead wingtip angle (degrees) |
| `bezierN` | `20` | Bezier sample count per edge (1 = straight lines) |
| `nodeApproach` | `0.5` | Through-node approach zone (multiple of halfW) |
| `creaseSkip` | `1` | Crease cleanup level (0 = raw, 1+ = cleaned) |

### Auto-Weight Propagation

Edge weights can be `number` or `'auto'`. Auto weights are resolved
topologically: merge outputs = sum of inputs, through-node outputs = input,
split outputs share the remainder equally. Use `resolveEdgeWeights(graph)`
to get the resolved numeric map.

### Auto-Bearing

Bearings are auto-derived for nodes with a single output (toward dest) or sinks with a single input (from source). Only multi-output split nodes need explicit bearings.

### Per-Node Velocity

`GFlowNode.velocity?: number` overrides the bezier control-point distance
at a node, controlling curve tightness. Applies symmetrically (G1 smooth
spline constraint). Undefined → auto-heuristic.

### Render Modes

- **`renderFlowGraphSinglePoly`** — single polygon per connected component (seamless at any opacity)
- **`renderFlowGraph`** — one polygon per edge + arrowheads (faster, slight seams at <100% opacity)
- **`renderFlowGraphDebug`** — debug geometry: bezier center lines, approach rectangles, arrowhead outlines
- **`renderEdgeCenterlines`** — per-edge bezier LineStrings (for hit-testing / selection overlays)

### MapLibre / Mapbox paint defaults (`flowFillPaint`)

When rendering multiple translucent ribbons that overlap, MapLibre's default
`fill-antialias: true` runs a second pass that strokes each feature's
boundary in draw order — the earlier-drawn (underneath) polygon's edge ends
up stroked *on top of* the polygon that was supposed to cover it, producing
a "ghost outline" artifact. `flowFillPaint()` returns a paint spec with
`fill-antialias: false` plus sensible defaults; any prop can be overridden:

```tsx
import { flowFillPaint } from 'geo-sankey'

<Layer id="flows-fill" type="fill"
       paint={flowFillPaint({ 'fill-opacity': 0.85 })} />
```

The paint spec is plain data, so this works with both `react-map-gl/maplibre`
and `react-map-gl/mapbox` — no map-library runtime dep.

## React Hooks (`geo-sankey/react`)

Composable hooks for building editing UIs on top of the geometry core:

```ts
import {
  useGraphState, useGraphSelection, useGraphMutations, useSceneIO,
  Drawer, SelectionSection, NodeOverlay,
} from 'geo-sankey/react'
```

| Hook | Purpose |
|---|---|
| `useGraphState(initial)` | Graph + undo/redo machine |
| `useGraphSelection(graph)` | Selection, resolved weights, node role, aggregators |
| `useGraphMutations(gs, sel)` | 13 graph mutation ops (add/delete/rename/split/reverse/...) |
| `useSceneIO(args)` | Export JSON/TS, copy graph to clipboard, paste-import modal |

Reference components: `<Drawer>`, `<SelectionSection>`, `<NodeOverlay>`.

Scene serialization for the "edit in browser → feed to Claude → update
source" workflow:
- `graphToTS(graph)` — `{ nodes, edges }` as a TS literal (paste into source)
- `sceneToTS(scene)` / `sceneToJSON(scene)` — full scene with opts + view
- `parseScene(text)` — accepts JSON, TS literal, or bare graph

## Demo Site

The [demo site][demo] includes:

- **HBT Ferry** — partial [NY Waterway][nyw] ferry network with splits, merges, and arrowheads
- **Simple Flow** — 6-node graph demonstrating split + merge
- Interactive controls: width unit (px/meters), opacity, wing/angle, BPL, approach, crease
- Debug overlays: ring points/edges with tooltips, graph bezier spines, approach rectangles
- Keyboard shortcuts (`?` to view all, `Cmd+K` for command palette)
- **Selection** always on — click nodes/edges to inspect in drawer
- **Edit mode** (checkbox in drawer or `e` key): drag nodes, dbl-click to add/split edges, Cmd+D to duplicate, multi-node drag
- **Export/Import**: `Cmd+Shift+G` copy graph as TS, `Cmd+Shift+E` download JSON, `Cmd+Shift+V` paste-import

## Prior & Related Art

### Terminology

- **Flow map** is the established cartographic term, dating to Charles Joseph Minard's work in the 1840s.
- **Sankey map** appears in academic literature (e.g. "Visualizing water infrastructure with Sankey maps", Journal of Maps, 2018) for geographically-placed Sankey diagrams.
- **Distributive flow map** refers specifically to the merge/split tree variant where tributaries combine into wider trunks.

### Existing libraries

| Library | Approach | Differences from geo-sankey |
|---|---|---|
| [flowmap.gl] (visgl) | deck.gl origin-destination flow lines | No merge/split trees, no width-proportional ribbons |
| [spatialsankey] | D3/Leaflet straight weighted lines | Straight lines only, no curved ribbons |
| [Transitive.js] (Conveyal) | Parallel transit route rendering | Schematic routes, no width-proportional ribbons |
| [d3-sankey] | Node-link Sankey diagrams | Not geographic |
| [kepler.gl] | General geo-visualization | No ribbon geometry primitives |
| deck.gl [ArcLayer] | Arcs between points | Arcs, not ribbons; no merge trees |

### Academic references

- "Flow Map Layout" — Phan et al., Stanford, InfoVis 2005
- "Flow Map Layout via Spiral Trees" — Buchin et al., IEEE TVCG 2011
- "Visualizing water infrastructure with Sankey maps" — Journal of Maps, 2018

### Transit map libraries

- [d3-tube-map] — schematic tube/metro maps
- [transit-map] (juliuste) — SVG transit maps

[demo]: https://geo-sankey.rbw.sh
[nyw]: https://www.nywaterway.com
[hbt-img]: screenshots/hbt-ferry.png
[hbt-demo]: https://geo-sankey.rbw.sh/?ex=hbt&o=0.85&nodes=1&llz=40.7415_-74.0180_12.60
[sf-img]: screenshots/simple-flow-debug.png
[sf-demo]: https://geo-sankey.rbw.sh/?ex=ferry&o=0.75&llz=40.7350_-74.0300_13.50&ring=1&graph=1&nodes=2
[flowmap.gl]: https://github.com/visgl/flowmap.gl
[spatialsankey]: https://github.com/nicholasjprimianomd/spatialsankey
[Transitive.js]: https://github.com/conveyal/transitive.js
[d3-sankey]: https://github.com/d3/d3-sankey
[kepler.gl]: https://kepler.gl
[ArcLayer]: https://deck.gl/docs/api-reference/layers/arc-layer
[d3-tube-map]: https://github.com/johnwalley/d3-tube-map
[transit-map]: https://github.com/juliuste/transit-map
