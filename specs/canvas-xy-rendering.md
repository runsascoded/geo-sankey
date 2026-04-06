# Canvas XY Rendering Layer

## Problem

geo-sankey computes geometry in screen space (Mercator-scaled XY) but outputs lat/lon GeoJSON, which the map renderer then projects back to screen pixels. This round-trip introduces:

1. **Unnecessary complexity**: The Mercator `lngScale` correction has been a recurring source of bugs (bezier directions, offset curve perpendiculars, face corners). The library already thinks in XY internally; LL encoding is packaging overhead.
2. **Renderer limitations**: GeoJSON polygons are opaque to the renderer — no per-vertex color, no gradient fills, no compositing control. Every rendering feature (seam-free opacity, color gradients) requires either geometry-level workarounds (singlePoly union) or a completely different output format (triangle meshes).
3. **Precision loss**: The screen→LL→screen round-trip at high zoom levels can introduce floating-point noise in vertex positions.

## Proposed Solution

Add a rendering mode where geo-sankey computes and draws in **flat pixel XY coordinates** on a canvas overlay anchored to the map. No GeoJSON intermediate. The library owns the rendering surface and draws directly with Canvas 2D or WebGL, enabling gradients, compositing, and seam-free opacity natively.

## Architecture

```
┌─────────────────────────────────────┐
│  Map renderer (MapLibre / Leaflet)  │
│  - base tiles, labels, interaction  │
├─────────────────────────────────────┤
│  geo-sankey canvas overlay          │  ← new
│  - ribbon geometry in pixel XY      │
│  - gradients, compositing, opacity  │
│  - synced to map viewport           │
└─────────────────────────────────────┘
```

### Projection

Node positions are defined in lat/lon (geographic input). At render time, convert to pixel XY using the map's current viewport:

```ts
interface Viewport {
  center: [number, number]  // [lat, lon]
  zoom: number
  bearing: number           // rotation, degrees
  width: number             // canvas px
  height: number            // canvas px
}

function project(pos: [number, number], vp: Viewport): [number, number]
function unproject(xy: [number, number], vp: Viewport): [number, number]
```

The projection is standard Web Mercator — `x = lon * 2^zoom * 256 / 360`, `y` from the Mercator formula — offset by the viewport center. This is a ~10-line function, no library dependency needed.

### Geometry Pipeline

```
Node positions (LL)
  → project to pixel XY at current zoom
  → compute beziers in XY (no lngScale needed — already flat)
  → compute offset curves in XY (perpendiculars are just 90° rotations)
  → compute face corners, junction bodies in XY
  → draw directly to canvas
```

The `lngScale` factor disappears entirely. Perpendiculars are simple `(-dy, dx)` rotations. Bearings are screen-space angles. Everything that was "Mercator-corrected" becomes straightforward 2D geometry.

### Drawing

**Canvas 2D** (simpler, sufficient for moderate-scale graphs):

```ts
const ctx = canvas.getContext('2d')

// Seam-free fill: draw all ribbons as a single compound path
ctx.beginPath()
for (const ribbon of ribbons) {
  ctx.moveTo(ribbon[0].x, ribbon[0].y)
  for (const pt of ribbon.slice(1)) ctx.lineTo(pt.x, pt.y)
  ctx.closePath()
}
ctx.globalAlpha = opacity
ctx.fill()  // single fill call — no seams

// Gradient fill per edge
for (const edge of edges) {
  const grad = ctx.createLinearGradient(
    edge.start.x, edge.start.y,
    edge.end.x, edge.end.y
  )
  grad.addColorStop(0, edge.fromColor)
  grad.addColorStop(1, edge.toColor)
  ctx.fillStyle = grad
  // ... fill edge ribbon path
}
```

Canvas 2D's compound path (`moveTo` + `lineTo` without `beginPath` between shapes) fills the union of all sub-paths in a single draw call — inherently seam-free. Gradients are native. Compositing modes (`globalCompositeOperation`) give full control over how layers blend.

**WebGL** (for large graphs or advanced effects):

Same triangle mesh approach as the vertex-color-gradients spec, but in pixel XY coordinates. No GeoJSON conversion needed. Stencil buffer for seam-free opacity, per-vertex colors for gradients.

## Map Integration

### MapLibre

MapLibre's [`CustomLayerInterface`][custom-layer] provides a WebGL context synced to the map's view matrix:

```ts
const geoSankeyLayer: maplibregl.CustomLayerInterface = {
  id: 'geo-sankey',
  type: 'custom',
  onAdd(map, gl) {
    // Initialize WebGL buffers or create Canvas 2D overlay
  },
  render(gl, matrix) {
    // matrix is the map's projection matrix
    // Alternatively: use map.project() to get pixel coords
    // and draw on a positioned <canvas> element
  },
}
map.addLayer(geoSankeyLayer)
```

For Canvas 2D (simpler): position a `<canvas>` element over the map container, listen for `move`/`zoom` events, and redraw. react-map-gl supports custom overlays via children or `useControl`.

### Leaflet

Leaflet's `L.Canvas` renderer or a custom `L.Layer` with `onAdd`/`onRemove`:

```ts
const layer = L.Layer.extend({
  onAdd(map) {
    this._canvas = L.DomUtil.create('canvas', '', map.getPane('overlayPane'))
    map.on('move zoom', this._redraw, this)
  },
  _redraw() {
    const bounds = this._map.getBounds()
    const topLeft = this._map.latLngToContainerPoint(bounds.getNorthWest())
    // ... project nodes, compute geometry, draw
  },
})
```

### deck.gl

deck.gl's `TriangleLayer` or `ScatterplotLayer` already renders in screen-projected coordinates. The canvas XY mesh output maps directly to deck.gl's data format.

## Relationship to Existing API

The canvas XY rendering mode is **additive** — the existing GeoJSON output (`renderFlowGraph`, `renderFlowGraphSinglePoly`) remains for users who want raw geometry for their own renderers or non-web use cases (server-side map generation, PDF export, etc.).

```ts
// Existing: GeoJSON output (unchanged)
const fc = renderFlowGraphSinglePoly(graph, opts)

// New: pixel XY geometry for direct canvas rendering
const xyGeom = computeFlowGraphXY(graph, viewport, opts)
drawFlowGraph(ctx, xyGeom, drawOpts)  // Canvas 2D
// or
const mesh = meshFlowGraph(xyGeom, meshOpts)  // WebGL vertex buffers
```

### Refactoring the Core

Internally, the geometry computation can be refactored so the core works in abstract XY, and the LL output mode is a thin wrapper:

```
computeFlowGraphXY(graph, viewport, opts)
  → abstract XY geometry (beziers, offset curves, faces)

renderFlowGraph(graph, opts)
  = computeFlowGraphXY(graph, implicitViewport, opts)
    → convert XY back to LL
    → wrap as GeoJSON FeatureCollection
```

This avoids duplicating logic between the two output paths.

## Curvature Assumption

This approach assumes the viewport is small enough that Mercator projection is approximately affine (uniform scale, no visible curvature). This holds comfortably at zoom 8+ (city to neighborhood scale). At zoom 6-7 (state/country scale), Mercator distortion within a single viewport becomes noticeable — but flow maps at that scale would have other problems (ribbons spanning hundreds of km look wrong on any projection).

If continental-scale flow maps become a goal, the projection function would need to account for local scale variation, but this is a concern for later.

## Implementation Plan

### Phase 1: XY geometry core
- Refactor `computeLayout`, `offsetCurve`, `directedBezier` to work in pure XY (remove `lngScale` / `refLat` parameters)
- Add `project(pos, viewport)` / `unproject` functions
- Existing GeoJSON output wraps XY core with LL conversion

### Phase 2: Canvas 2D renderer
- `drawFlowGraph(ctx, graph, viewport, opts)` — single function that projects, computes, and draws
- Compound path fill for seam-free opacity
- Linear gradients for per-edge color transitions
- Arrowheads drawn as filled sub-paths

### Phase 3: Map overlay integration
- MapLibre: React component wrapping a `<canvas>` overlay, synced to map viewport
- Leaflet: `L.Layer` extension
- Publish as `@geo-sankey/canvas` or similar

### Phase 4: WebGL renderer (optional)
- For large graphs or per-vertex color effects
- Triangle mesh in XY coordinates with stencil-based opacity
- deck.gl integration via custom layer
- Publish as `@geo-sankey/deck`

## Open Questions

- **Interaction**: Canvas overlay intercepts mouse events. Need to either pass events through to the map (pointer-events: none + custom hit testing) or implement picking on the canvas (point-in-polygon test against ribbon geometry). The existing MapLibre layer gets picking for free from the map renderer.
- **Retina / DPR**: Canvas needs to account for `devicePixelRatio` for sharp rendering on HiDPI displays. Standard pattern: canvas element dimensions = CSS dimensions * DPR, then `ctx.scale(dpr, dpr)`.
- **Performance on move**: Redrawing the entire canvas on every map pan/zoom frame. For complex graphs, this could be expensive. Mitigations: (a) requestAnimationFrame throttling, (b) cache the XY geometry and only reproject on zoom change (pan is just a translation offset), (c) WebGL with GPU buffers (no per-frame recomputation).
- **Z-ordering with map labels**: The canvas overlay sits above or below map labels. MapLibre's `CustomLayerInterface` allows inserting at a specific layer position; a DOM canvas overlay is always on top. May need to render below labels but above base tiles.
- **Text rendering**: Node labels rendered via Canvas 2D `fillText` vs. map renderer's symbol layer. Canvas text is simpler but doesn't participate in the map's label collision detection. Could keep labels in MapLibre's symbol layer while rendering ribbons on canvas.

[custom-layer]: https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/
