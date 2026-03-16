# Graph-Based Flow Rendering

## Problem

The current tree-based model (`FlowTree` / `FlowNode`) forces users to decompose flow graphs into separate trees, invent placeholder nodes for cross-tree connections, and manage junction maps. This creates:
- Complex, fragile rendering code (recursive stitching, cross-tree coordination)
- Visual artifacts at cross-tree junctions
- An abstraction that doesn't match the domain (flows are DAGs, not trees)

## Proposed Model

Users provide a flow graph as **edges** (source→dest with weight) and **node positions**. The library derives merge/split geometry automatically.

### Data Model

```ts
interface FlowNode {
  id: string
  pos: LatLon
  /** Bearing of the node's throughput axis (degrees, 0=N 90=E).
   *  Inputs merge from behind this bearing, outputs split ahead of it. */
  bearing: number
  /** Optional label for display */
  label?: string
}

interface FlowEdge {
  from: string  // node ID
  to: string    // node ID
  weight: number
}

interface FlowGraph {
  nodes: FlowNode[]
  edges: FlowEdge[]
}
```

### Rendering

```ts
interface FlowGraphOpts {
  refLat: number
  zoom: number
  geoScale?: number           // default 1
  pxPerWeight: number | ((w: number) => number)
  color: string
  arrowWing?: number          // default 1.8
  arrowLen?: number           // default 1.2
  singlePoly?: boolean        // default true
  plugBearingDeg?: number     // default 1
  plugFraction?: number       // default 0.3
}

function renderFlowGraph(graph: FlowGraph, opts: FlowGraphOpts): GeoJSON.FeatureCollection
```

### Geometry Construction

For each node, the library computes:

1. **Input weight** = sum of weights of incoming edges
2. **Output weight** = sum of weights of outgoing edges
3. **Through weight** = max(input, output) — the node's "width"

Three types of shapes per node:

#### Node body (rectangle)
- A straight segment along the node's bearing
- Width = through weight (in px via `pxPerWeight`)
- Length = `1.5 * halfWidth` (the approach/departure length)
- This is where inputs tile seamlessly into outputs

#### Input edges (bezier ribbons)
- One ribbon per incoming edge
- Each input gets a **merge slot**: perpendicular offset within the node's input face
- Slots are ordered to minimize crossings (or user-specified)
- Ribbon goes from the source node's output slot to this node's input slot
- Width = edge weight
- Path: `directedBezier(srcSplitOffset, dstMergeOffset, srcBearing, dstBearing)`

#### Output edges (bezier ribbons)
- One ribbon per outgoing edge
- Each output gets a **split slot**: perpendicular offset within the node's output face
- Same ordering logic as inputs
- Ribbon goes from this node's output slot to the dest node's input slot
- (Same ribbons as the dest node's input edges — each edge is rendered once)

#### Arrowheads
- Sink nodes (outputs = 0) get an arrowhead on their input face
- Or: configurable per-node

### Slot Computation

For a node with bearing B and through-width W:

**Input face** (behind the bearing):
- Center = `node.pos - forward(B) * approachLen`
- Each incoming edge gets a slot offset perpendicular to B
- Slot order: sorted by source bearing relative to B (minimizes crossings)
- Slot position: `center + perpLeft(B) * slotOffset`

**Output face** (ahead of the bearing):
- Center = `node.pos + forward(B) * approachLen`
- Each outgoing edge gets a slot offset perpendicular to B
- Same ordering logic

The node body connects the input face to the output face — a straight segment where the input slots tile into the output slots. If a node has only inputs (sink) or only outputs (source), there's only one face.

### Single-Polygon Mode

With the graph model, single-polygon construction is cleaner:

1. For each edge, compute left/right ribbon edges
2. For each node body, compute left/right rectangle edges
3. At each node, stitch input edges → body → output edges by walking the perimeter

For the entire graph as one polygon:
- Walk the outer perimeter of all connected shapes
- Inner gaps (between adjacent edges at a node) are the branch crevices — apply convergence plugging as before

For per-node polygons (if per-node coloring is needed):
- Each node + its input edges form one polygon
- Cross-node edges are shared between the source's output and dest's input

### Comparison with Current Model

| Aspect | Current (tree) | Proposed (graph) |
|---|---|---|
| User input | Recursive `FlowNode` trees | Flat edges + nodes |
| Cross-node flows | Manual placeholder nodes + junction map | Automatic — each edge connects two nodes |
| Rendering | Per-tree recursive traversal | Per-edge + per-node, then stitch |
| Single-poly stitching | Recursive edge collection with inner comb | Walk perimeter of connected shapes |
| Split/merge | Explicit node types | Implicit from in/out degree |
| Ordering | User-specified child array order | Auto-sort by bearing, with overrides |

### Migration

The existing `FlowTree` API can remain as a convenience wrapper that compiles trees into the graph model internally. This avoids breaking existing consumers:

```ts
function flowTreeToGraph(tree: FlowTree, destPos: LatLon): FlowGraph
```

### Example: Ferry Layout

```ts
const graph: FlowGraph = {
  nodes: [
    { id: 'origin', pos: [40.735, -74.045], bearing: 90, label: 'Origin' },
    { id: 'split',  pos: [40.735, -74.040], bearing: 90 },
    { id: 'merge',  pos: [40.735, -74.020], bearing: 90 },
    { id: 'dest',   pos: [40.735, -74.005], bearing: 90, label: 'Destination' },
    { id: 'north',  pos: [40.745, -74.035], bearing: 150, label: 'North' },
    { id: 'south',  pos: [40.725, -74.030], bearing: 30, label: 'South' },
  ],
  edges: [
    { from: 'origin', to: 'split', weight: 35 },
    { from: 'split', to: 'merge', weight: 20 },
    { from: 'split', to: 'south', weight: 15 },
    { from: 'north', to: 'merge', weight: 30 },
    { from: 'merge', to: 'dest', weight: 50 },
  ],
}
```

No placeholder nodes, no junction maps, no separate trees. The library sees that `split` has 2 outputs and computes the split geometry. `merge` has 2 inputs and computes the merge geometry. The edge from `split→merge` connects the two automatically.

## Implementation Plan

1. **Types**: `FlowGraph`, `FlowNode` (new), `FlowEdge` in `types.ts`
2. **Slot computation**: `computeSlots(graph, opts)` — computes merge/split offsets for each node
3. **Edge rendering**: `renderEdge(edge, srcSlot, dstSlot, opts)` — bezier ribbon between slots
4. **Node body rendering**: `renderNodeBody(node, slots, opts)` — rectangle connecting input/output faces
5. **Arrowhead**: attached to sink nodes
6. **Single-poly stitching**: walk perimeter of connected node+edge shapes
7. **`renderFlowGraph`**: orchestrates 2-6, returns GeoJSON features
8. **`flowTreeToGraph`**: migration helper for existing FlowTree consumers
9. **Update examples**: FerryTest, MultiTreeMerge using graph API
