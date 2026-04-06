# Vertex-Color Gradient Ribbons

## Problem

geo-sankey currently outputs flat-colored GeoJSON `Polygon` features. This has two limitations:

1. **Seam artifacts**: Adjacent polygons at partial opacity produce visible seams where they overlap (double-blended) or gap (anti-aliasing). The `singlePoly` mode works around this by unioning geometry, but it's a geometry-level workaround for a rendering-level problem.

2. **No color transitions**: Every polygon is a single color. At merge nodes where two differently-colored inputs combine, there's an abrupt color boundary. Ideally, each input ribbon would gradient-fade into the merged output color through the junction body.

## Proposed Solution

Add a new render mode that outputs **triangle meshes with per-vertex colors** instead of GeoJSON polygons. GPU rasterization natively interpolates vertex colors across triangle interiors at pixel resolution (Gouraud shading), giving smooth gradients with no tessellation artifacts.

### Output Format

```ts
interface VertexColorMesh {
  /** Flat array of [lon, lat] vertex positions */
  positions: Float64Array   // length = 2 * numVertices
  /** Per-vertex RGBA colors, 0-255 */
  colors: Uint8Array        // length = 4 * numVertices
  /** Triangle indices (3 per triangle) */
  indices: Uint32Array      // length = 3 * numTriangles
}
```

This maps directly to WebGL vertex buffers / deck.gl `TriangleLayer` input.

### Per-Edge Color

Extend `GFlowEdge` with an optional color:

```ts
interface GFlowEdge {
  from: string
  to: string
  weight: number
  color?: string  // defaults to FlowGraphOpts.color
}
```

Each edge ribbon is colored by its edge color. At merge/split nodes, the junction body interpolates between input/output edge colors.

## Geometry Construction

### Step 1: Ribbon Quads (existing)

The library already computes left/right offset curves for each edge. Each pair of consecutive sample points forms a quad (2 triangles):

```
left[i] ---- left[i+1]
  |    \        |
  |     \       |
  |      \      |
right[i] -- right[i+1]
```

Triangle 1: `left[i], right[i], left[i+1]`
Triangle 2: `right[i], right[i+1], left[i+1]`

For a single-color edge, all vertices get the same color. For a gradient edge (e.g. approaching a merge where colors blend), vertex colors interpolate along the path parameter `t ∈ [0, 1]`.

### Step 2: Color Assignment

**Simple edges** (same color at both ends): All vertices get the edge color.

**Merge node inputs**: Each input edge transitions from its own color to the output edge's color. The transition region is the node's approach zone (already computed as `approachLen`). Vertices in the approach zone get interpolated colors:

```
t = 0.0 (edge start)     → edge.color
t = approachStart         → edge.color
t = 1.0 (node boundary)  → outputEdge.color
```

**Split node outputs**: Mirror of merge — output edges transition from the input edge's color to their own color through the approach zone.

**Through-nodes**: Input color transitions to output color through the node body.

### Step 3: Junction Bodies

At merge/split nodes, the junction body polygon connects multiple input/output ribbons. This body needs to be triangulated with vertex colors that match the adjacent ribbon endpoints.

The body is bounded by face corners (already computed in `computeLayout`). Triangulate with a fan from the node center point, assigning the center vertex a blended color (weighted average of all input/output colors by weight).

```
         inFaceLeft_A ---- inFaceRight_A
              \               /
               \    center   /
                \    (avg)  /
                 \         /
         outFaceLeft ---- outFaceRight
```

Each fan triangle has:
- Center vertex: weighted-average color
- Two boundary vertices: their respective edge colors

GPU interpolation handles the smooth blend.

### Step 4: Arrowheads

Arrowhead triangles (wingtip-to-tip) use the edge color for the stem base vertices and the same color (or a highlight/darkened variant) for the tip vertex.

## Stencil-Based Opacity

With triangle mesh output, a stencil buffer pass solves the overlap/seam problem at the rendering level:

1. **Stencil pass**: Render all triangles to the stencil buffer only (no color write). Each pixel covered by any triangle gets stencil = 1.
2. **Color pass**: Render a full-screen quad with the desired opacity, masked by stencil = 1.

This ensures each pixel is blended exactly once regardless of overlapping geometry. However, this only works for uniform opacity — per-edge or per-vertex opacity would need a different approach (e.g. render to an offscreen framebuffer at full opacity, then composite with the desired opacity).

For the gradient color case, the simpler approach works:
1. Render all triangles to an offscreen framebuffer at **full opacity** with per-vertex colors.
2. Composite the framebuffer onto the map at the desired uniform opacity.

This gives both smooth gradients and seam-free blending.

## Rendering Targets

### deck.gl (primary)

deck.gl's `TriangleLayer` (or a custom layer) can consume `positions`, `colors`, `indices` directly as GPU buffers. This is the most natural fit.

A `GeoSankeyLayer` could wrap the mesh generation:

```ts
import { CompositeLayer } from '@deck.gl/core'

class GeoSankeyLayer extends CompositeLayer {
  renderLayers() {
    const mesh = renderFlowGraphMesh(this.props.graph, this.props.opts)
    return [new TriangleLayer({
      data: { positions: mesh.positions, colors: mesh.colors, indices: mesh.indices },
      opacity: this.props.opacity,
      // offscreen FBO compositing for seam-free opacity
    })]
  }
}
```

### regl / raw WebGL

For non-deck.gl users, the mesh format maps directly to `gl.drawElements` with vertex attribute buffers. A thin helper could handle the stencil/FBO setup.

### Fallback: GeoJSON

The existing `renderFlowGraph` / `renderFlowGraphSinglePoly` modes remain for renderers that only consume GeoJSON (Leaflet, MapLibre native layers). The triangle mesh mode is additive.

## API

```ts
/** Render flow graph as a triangle mesh with per-vertex colors. */
export function renderFlowGraphMesh(
  graph: FlowGraph,
  opts: FlowGraphOpts,
): VertexColorMesh

/** Convenience: split mesh into per-component sub-meshes. */
export function renderFlowGraphMeshes(
  graph: FlowGraph,
  opts: FlowGraphOpts,
): VertexColorMesh[]
```

`FlowGraphOpts` gains:
```ts
interface FlowGraphOpts {
  // ... existing fields ...
  /** Per-edge color fallback (existing, used when edge.color is unset) */
  color: string
  /** Color interpolation mode at merge/split junctions */
  colorBlend?: 'weighted' | 'linear'  // default: 'weighted'
  /** Fraction of edge length over which color transitions at junctions (0-1) */
  colorTransition?: number  // default: 0.3 (uses approach zone)
}
```

## Implementation Plan

### Phase 1: Single-color mesh output
- Convert existing offset curve quads to triangle mesh format
- Output `VertexColorMesh` with uniform color per edge
- Verify rendering in deck.gl `TriangleLayer`
- Confirm stencil/FBO approach eliminates seams

### Phase 2: Per-edge colors
- Add `color` field to `GFlowEdge`
- Assign per-vertex colors based on edge color
- No gradient yet — just different colors per edge

### Phase 3: Junction color gradients
- Implement approach-zone color interpolation for merge inputs / split outputs
- Triangulate junction bodies with fan from weighted-average center
- Smooth gradient transitions at all node types

### Phase 4: deck.gl layer package
- Publish `@geo-sankey/deck` (or similar) with `GeoSankeyLayer`
- Handle opacity via offscreen FBO compositing
- Integrate with deck.gl's picking, tooltips, animation

## Open Questions

- **Opacity per edge**: Should edges support individual opacity values? This complicates the FBO approach (can't do single-pass compositing). Could use a two-pass approach: render opaque to FBO with alpha channel encoding per-vertex opacity, then composite.
- **Animated transitions**: deck.gl supports interpolating between states. Should the mesh format support keyed vertices for animation (e.g. flow pulse effects)?
- **Non-linear color interpolation**: Linear RGB interpolation can produce muddy midpoints (e.g. blue + yellow → gray). Should we support perceptual color spaces (OKLab) for blending? This would require doing the interpolation in the vertex color assignment, not relying on GPU linear interpolation.
- **Texture-based approach**: An alternative to per-vertex colors is UV-mapping the ribbons and applying a 1D gradient texture per edge. This would allow arbitrary color ramps (not just linear interpolation) and could encode opacity too. More complex but more flexible.
