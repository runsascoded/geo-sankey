# geo-sankey: Geographic Flow Map Renderer

A TypeScript library for rendering width-proportional flow ribbons and parallel transit-style routes on geographic maps. Pure geometry engine — produces GeoJSON polygons; bring your own map renderer (MapLibre, Leaflet, deck.gl, etc.).

## Design Philosophy

- **Display library, not a layout algorithm.** User specifies positions, bearings, weights, merge/split points. Library computes ribbon geometry.
- **Map-renderer agnostic.** Output is GeoJSON `Feature[]` (Polygon for ribbons, LineString for centerlines). Works with any renderer that consumes GeoJSON.
- **Two visualization modes** sharing core geometry primitives:
  1. **Flow ribbons**: width-proportional weighted flows with merge/split trees, arrowheads
  2. **Parallel routes**: multiple named lines running side-by-side between shared stations/stops

## Prior Art & Positioning

| Library | What it does | Gap we fill |
|---|---|---|
| flowmap.gl | Independent OD flow lines (deck.gl) | No merge/split trees, no ribbon geometry |
| spatialsankey | Straight weighted lines on Leaflet | No merge trees, no smooth ribbons |
| Transitive.js | Parallel transit routes, schematic maps | No width-proportional ribbons |
| d3-sankey | Sankey layout + rendering | Not geographic, no map projection |

The canonical cartographic term is **flow map**. "Sankey map" appears in academic literature (Journal of Maps 2018). Library name `geo-sankey` is catchy and searchable.

## Core Geometry Primitives

These are the shared building blocks used by both flow ribbons and parallel routes:

```ts
type LatLon = [number, number]  // [lat, lon]

// Catmull-Rom spline through waypoints
function smoothPath(pts: LatLon[], segsPerSpan?: number): {
  path: LatLon[]   // smooth polyline
  knots: number[]  // output indices of each input point
}

// Ribbon polygon (no arrowhead)
function ribbon(path: LatLon[], halfW: number, refLat: number): GeoJSON.Feature<Polygon>

// Ribbon polygon with integrated arrowhead
function ribbonArrow(path: LatLon[], halfW: number, opts: {
  refLat: number
  wingFactor?: number   // default 1.8
  lenFactor?: number    // default 1.2
  widthPx?: number      // for adaptive wing sizing on narrow flows
}): GeoJSON.Feature<Polygon>

// Perpendicular/forward unit vectors at path waypoint
function perpAt(path: LatLon[], i: number): LatLon
function fwdAt(path: LatLon[], i: number): LatLon

// Bezier with explicit departure/arrival bearings
function directedBezier(start: LatLon, end: LatLon, opts?: {
  departBearing?: number  // degrees, 0=N 90=E
  arriveBearing?: number
}): LatLon[]

// Pixel↔degree conversions
function pxToHalfDeg(widthPx: number, zoom: number, refLat: number, geoScale?: number): number
function pxToDeg(px: number, zoom: number, refLat: number, geoScale?: number): number
```

## Mode 1: Flow Ribbons (Merge/Split Trees)

For visualizing weighted flows that merge or split at explicit junction points. Each flow has a weight (width), and at merge/split points, tributaries tile seamlessly into a wider trunk.

### Data Model

```ts
// A node in the merge/split tree
type FlowNode =
  | { type: 'source'; pos: LatLon; weight: number; id?: string }
  | { type: 'merge'; pos: LatLon; bearing: number; children: FlowNode[] }
  // Future: 'split' (reverse of merge — one input fans out to multiple outputs)

// A complete flow: tree of sources merging into a destination
interface FlowTree {
  id: string
  destPos: LatLon
  root: FlowNode
  color?: string
  arrowhead?: boolean  // default true
}

// Rendering options
interface FlowRenderOpts {
  zoom: number
  refLat: number
  geoScale?: number          // 0 = fixed px, 1 = geo-scaled (default 1)
  widthScale?: number        // global width multiplier (default 1)
  maxWidthPx?: number        // clamp max ribbon width
  pxPerWeight?: number       // pixels per unit weight (alternative to maxWidthPx)
  arrowWingFactor?: number   // default 1.8
  arrowLenFactor?: number    // default 1.2
  direction?: 'forward' | 'reverse'  // reverse path for "leaving" flows
}
```

### API

```ts
// Render a flow tree → GeoJSON features (polygons)
function renderFlowTree(tree: FlowTree, opts: FlowRenderOpts): GeoJSON.Feature[]

// Render multiple trees → sorted features (widest first for correct z-order)
function renderFlows(trees: FlowTree[], opts: FlowRenderOpts): GeoJSON.FeatureCollection
```

### Merge Geometry Details

At each merge node:
- **Bearing** determines the outgoing trunk direction
- **Perpendicular** to bearing determines the stacking axis for children
- Children are stacked right→left relative to flow direction
- Each child gets a **straight approach segment** into the merge (guarantees parallel ribbon edges at junction)
- Trunk gets a **straight departure segment** out of the merge (ditto)
- `nodeWidth(merge) = sum(nodeWidth(children))` — exact sum, not recomputed from weight, to avoid rounding mismatch
- Approach/departure length = `1.5 * halfWidth` of the trunk

## Mode 2: Parallel Routes (Transit Map Style)

For visualizing multiple named routes that share segments between stations. Each route has its own color and (optionally) width. When multiple routes share a segment, they're drawn side-by-side with perpendicular offsets.

### Data Model

```ts
interface Station {
  id: string
  name: string
  pos: LatLon
}

interface Route {
  id: string
  name: string
  color: string
  width?: number          // px, default 4
  stops: string[]         // station IDs in order
  // Waypoints between stops (for geographic accuracy)
  waypoints?: Record<string, LatLon[]>  // "stopA→stopB" → intermediate points
}

// Offset spec: when routes share a segment, offset each by N px
// (computed automatically from co-occurring routes, or user-specified)
interface SegmentOffset {
  from: string   // station ID
  to: string     // station ID
  offsets: Record<string, number>  // route ID → px offset
}

interface ParallelRouteOpts {
  stations: Station[]
  routes: Route[]
  offsets?: SegmentOffset[]     // explicit; if omitted, auto-compute from co-occurrence
  zoom: number
  refLat: number
  gapPx?: number               // gap between parallel routes (default 1)
  smooth?: boolean              // Catmull-Rom smoothing (default true)
}
```

### API

```ts
// Render parallel routes → GeoJSON features
function renderParallelRoutes(opts: ParallelRouteOpts): GeoJSON.FeatureCollection

// Auto-compute offsets from route co-occurrence on shared segments
function computeOffsets(stations: Station[], routes: Route[], gapPx?: number): SegmentOffset[]
```

### Parallel Route Geometry Details

When multiple routes share a segment (same consecutive station pair):
- Compute perpendicular to the segment direction
- Each route gets a pixel offset: `-(totalWidth/2) + cumulative + own/2`
- The `offsetLine()` function displaces both endpoints perpendicularly
- At junctions where routes diverge, each route curves smoothly to its own next station

### Route Ordering & Crossovers

When multiple routes share segments, the library must decide the **lateral order** of routes on each segment. This is a bounded layout problem (not the open-ended "where should merge points go" problem we explicitly avoid).

**Auto-ordering goals:**
- Minimize crossovers globally (or greedily per-segment)
- This is essentially minimizing edge crossings in a layered graph — NP-hard in general, but tractable for small N with heuristics (barycentric ordering, median heuristic)

**Crossover rendering:**
- When route order *must* change between consecutive shared segments (A is left of B on segment 1, but right of B on segment 2), draw a smooth crossing in the gap between stations
- Crossovers should look intentional: short bezier curves where ribbons swap sides
- Crossover region should be visually distinct from normal parallel running

**User overrides:**
```ts
interface ParallelRouteOpts {
  // ... existing fields ...
  orderingHints?: SegmentOrdering[]   // pin specific orderings
}

interface SegmentOrdering {
  from: string          // station ID
  to: string            // station ID
  order: string[]       // route IDs, left-to-right
}
```

Users can pin a specific ordering on a specific segment, force a route to a specific side, or mark crossover locations. Auto-computed ordering is the default; hints override where specified.

## Shared Properties on Output Features

All output GeoJSON features include properties for styling:

```ts
interface FlowFeatureProperties {
  id: string           // flow/route ID
  color?: string
  width: number        // px width (for sorting/hover)
  opacity?: number     // default 1
  type: 'ribbon' | 'arrow' | 'parallel-route'
  // For flow ribbons:
  nodeId?: string      // which tree node this came from
  terminal?: boolean   // is this the final segment (has arrowhead)?
  // For parallel routes:
  routeId?: string
  segmentFrom?: string
  segmentTo?: string
}
```

## Package Structure

```
geo-sankey/
├── src/
│   ├── index.ts              # public API re-exports
│   ├── types.ts              # shared types
│   ├── geo.ts                # geographic helpers (pxToDeg, LNG_SCALE, etc.)
│   ├── path.ts               # smoothPath, perpAt, fwdAt, directedBezier
│   ├── ribbon.ts             # ribbon(), ribbonArrow()
│   ├── flow.ts               # renderFlowTree, renderFlows, merge geometry
│   ├── parallel.ts           # renderParallelRoutes, computeOffsets
│   └── __tests__/
│       ├── ribbon.test.ts
│       ├── flow.test.ts
│       └── parallel.test.ts
├── site/                     # demo site (Vite + React + MapLibre)
│   ├── src/
│   │   ├── App.tsx
│   │   ├── examples/
│   │   │   ├── HudsonTransit.tsx    # hudson-transit flow map demo
│   │   │   ├── JCBikeBus.tsx        # JC bike bus parallel routes demo
│   │   │   └── Simple.tsx           # minimal example
│   │   └── ...
│   └── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Build & Distribution

- TypeScript, ESM-first
- Vite for library build (`vite build --lib`) and demo site
- Zero runtime dependencies (pure geometry, GeoJSON output)
- Published to npm as `geo-sankey`
- `npm-dist` for git-installable dist branches

## Demo Site Examples

### 1. Hudson Transit (Flow Ribbons)
Reproduce the current hudson-transit GeoSankey visualization: tunnel/bridge flows with width proportional to passengers, ferry Sankey merge trees, Uptown PATH with hover-reveal.

### 2. JC Bike Bus (Parallel Routes)
Resurrect the bike bus map: 10+ colored routes with parallel offset rendering on shared segments, station markers, route selection.

### 3. Simple (Getting Started)
Minimal example: two flows merging into one, rendered on a MapLibre map. ~20 lines of user code.

## Migration Plan (hudson-transit)

1. **Phase 1**: Extract geometry primitives (`ribbon`, `ribbonArrow`, `smoothPath`, `perpAt`, `fwdAt`, `directedBezier`, geo helpers) into `geo-sankey/src/`. No API changes, just moving code.
2. **Phase 2**: Extract flow tree rendering (`renderFlowTree`) — the recursive merge logic. hudson-transit defines `FlowTree` specs, passes to library.
3. **Phase 3**: hudson-transit imports `geo-sankey`, deletes extracted code. All domain-specific config (routes, colors, modes, labels, URL state, controls) stays in hudson-transit.
4. **Phase 4**: Add parallel route support, port JC bike bus to use it.

## Open Questions

- Should the library handle hit-target generation (invisible centerline LineStrings for hover)? Probably yes — it's closely tied to the ribbon geometry.
- Should `direction: 'reverse'` be handled by the library (reversing paths for "leaving" vs "entering" flows)? Or should the consumer reverse before passing in?
- For parallel routes: auto-offset computation vs. user-specified offsets? BJC bike bus uses user-specified. Auto-compute is more convenient but may need manual overrides.
- Arrowhead on parallel routes? Probably not by default (transit maps don't have arrows), but the option should exist.
- For the hudson-transit use case of "autos next to buses in same tunnel" — this is actually the parallel-routes mode, not flow-ribbon mode. Each mode (Autos, Bus) would be a separate route sharing the Lincoln/Holland tunnel segment. The library should make it easy to combine both modes in one visualization.
