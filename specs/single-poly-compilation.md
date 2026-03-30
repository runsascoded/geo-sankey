# Single-Polygon Compilation

## Problem

The current single-poly implementation builds individual ribbon edge-pairs (via `ribbonEdges` which uses `perpAt`), then stitches them into a ring. This fails because `perpAt` gives different perpendicular directions at node boundaries for different bezier curves, creating gaps/overlaps that produce visible double-opacity rectangles.

## Solution: Direct Perimeter Computation

Don't use `ribbonEdges` for single-poly. Instead, compute the perimeter ring directly from the flow graph geometry.

### Data Flow

```
FlowGraph (nodes + edges)
  → computeLayout (slot positions, approach lengths)
  → computeEdgeCurves (bezier paths per edge)
  → computePerimeter (one [lon,lat][] ring)
  → GeoJSON Polygon Feature
```

### Edge Offset Curves

For each edge bezier path, compute LEFT and RIGHT offset curves:

```ts
function offsetCurve(
  path: LatLon[],
  halfW: number,
  refLat: number,
  startBearing: number,  // node bearing at path start
  endBearing: number,    // node bearing at path end
): { left: [number, number][], right: [number, number][] }
```

**Key difference from `ribbonEdges`**: at the first and last N points (the "approach zone"), use the NODE BEARING to compute the perpendicular, not `perpAt` on the bezier. This ensures all edges at the same node face have their endpoints at the same perpendicular positions.

Interior points use `perpAt` (smooth curves). The transition from node-bearing perp to bezier-tangent perp happens over the first/last few points of the path.

### Node Face Geometry

Each through-node has an input face and output face. These are rectangles at ±approachLen from the node center, spanning ±throughHalfW perpendicular to the bearing.

The face geometry is computed ONCE from the node bearing — not from any bezier. Face corners:
```
inFaceLeft  = node.pos - fwd*approach - perpRibbon*throughHalfW
inFaceRight = node.pos - fwd*approach + perpRibbon*throughHalfW
outFaceLeft  = node.pos + fwd*approach - perpRibbon*throughHalfW
outFaceRight = node.pos + fwd*approach + perpRibbon*throughHalfW
```

Where `perpRibbon` is the ribbon convention perpendicular (opposite of `perpL`).

### Perimeter Walk

The perimeter is built by a DFS that traces the outer boundary:

```
traceBranch(nodeId, arrivedViaEdge):
  // FORWARD: node prefix
  if source: source trunk left edge (uses node bearing perp)
  if through: face left edge [inFaceLeft → outFaceLeft]

  // FORWARD: each output edge
  for each output edge (sorted):
    edge offset LEFT curve (starts at outFace slot, uses node bearing at start)
    recurse into dest node
    edge offset RIGHT curve reversed (starts at outFace slot, uses node bearing)

  // BACKWARD: merge side-inputs
  for each non-main input (reversed order):
    input RIGHT reversed (ends at inFace slot)
    trace source
    input LEFT (starts at inFace slot)

  // BACKWARD: node suffix
  if source: source trunk right edge reversed
  if through: face right edge reversed [outFaceRight → inFaceRight]
```

### Key Invariant

At every node boundary, consecutive points in the ring are computed from the SAME perpendicular direction (the node bearing). This eliminates the gap/overlap issue.

- Face left/right edges use the node bearing
- Edge offset curves at their endpoints use the same node bearing
- The transition to bezier-tangent perp happens in the curve interior (invisible)

### Arrowhead

For sink nodes, the arrowhead is just 3-5 points:
- Wing-left: at the input face, offset by wingHalfW in the node bearing perp direction
- Tip: at node.pos (or slightly forward)
- Wing-right: symmetric to wing-left

These points use the node bearing perp — same as the face geometry.

### Interactive Mode (Future)

The FlowGraph model supports CRUD:
- Nodes: add/remove/move/change bearing
- Edges: add/remove/change weight
- Export/import as JSON

The rendering pipeline is: FlowGraph → layout → perimeter → GeoJSON. Any change to the FlowGraph triggers a full re-render (fast enough for interactive use since it's just geometry computation, no I/O).

## Implementation Plan

1. `offsetCurve()`: like `ribbonEdges` but with forced node-bearing perp at endpoints
2. Refactor `computeLayout` to also return face corner positions per node
3. `computePerimeter()`: the DFS walk, using face corners and offset curves
4. Wire up in `renderFlowGraphSinglePoly`
5. Tests: verify no self-intersections for simple, merge, split, ferry, HBT graphs
