# Editor v2: Segment-Level Properties, Bezier Handles, Multi-Select

Follow-up to [editable-mode](done/editable-mode.md). The v1 editor established
in-place overlays, rotation handles, and undo/redo. v2 makes the editor
expressive enough to construct a diagram entirely in the browser, tune its
appearance per-segment, and paste the result into source as a default scene.

## Goals

1. **Per-segment property control.** Each node and edge gets its own settings
   (color, opacity, width, curvature, etc.), overriding page-level defaults.
2. **Properties drawer, not a top bar.** Replace the fixed config strip above
   the map with a drawer attached to the current selection.
3. **Bezier handles with smooth-spline constraint** — C1 continuity through
   nodes, 2 DOF per node (bearing + handle length).
4. **Multi-select + bulk edits.** Shift-click to add features; set, increment,
   or decrement values across a heterogeneous selection.
5. **Flow-conservation weights.** Merge-output and through-edge weights can be
   auto-derived from inputs.
6. **Scene round-trip.** Export YAML/JSON that captures graph + per-segment
   overrides + view, paste into code as the default scene for a page.
7. **Easy node-type affordances.** Sources, sinks, waypoints, merges, splits
   without ever having to think about `bearing`.
8. **Physical-unit widths.** Alternative to `pxPerWeight`: meters-per-weight,
   re-computed on zoom change so a 100-weight flow is always ~X meters wide.

## Phase 1 — Properties Drawer + Page Defaults + Multi-Select

### 1.1 Drawer replaces top-bar config

Remove the top controls strip. Its contents redistribute as:

- **Diagram-scope settings** (color, pxPerWeight/mPerWeight, wing, angle, BPL,
  nodeApproach, creaseSkip, opacity, widthScale) → moved into a **Page
  Defaults** panel. This panel lives in an always-on sidebar/drawer (left or
  right edge of the map) under a collapsible "Defaults" group.
- **View toggles** (single-poly, ring points, graph overlay, node display mode)
  → stay accessible but in a compact toolbar/menu, not spread across the top.
- **Per-segment overrides** → shown in the drawer when a node/edge is selected.

### 1.2 Per-segment `style` / `opts`

Extend the types:

```ts
interface SegmentStyle {
  color?: string
  opacity?: number
  widthScale?: number     // multiplier on pxPerWeight for this segment
  wing?: number
  angle?: number
  nodeApproach?: number   // nodes only
  // bezier shape (see Phase 2)
  handleLenIn?: number
  handleLenOut?: number
}

interface GFlowNode { /* ... */ style?: SegmentStyle & NodeStyle }
interface GFlowEdge { /* ... */ style?: SegmentStyle }
```

Rendering (`renderFlowGraph` etc.) reads per-segment values, falling back to
the `FlowGraphOpts` default when unset. This requires threading segment-level
style into `computeLayout` and the ribbon/arrowhead construction.

### 1.3 Multi-select

- **Shift-click** on a node or edge toggles its membership in the selection.
- Drawer shows aggregated state:
  - If all selected segments share the same value for a property → show it.
  - Else → show "Mixed" placeholder; editing applies the new value uniformly.
- **Bulk ops**: set exact value, `+=` step, `-=` step, reset-to-default.
  Increment/decrement acts on each segment's current value (preserving relative
  offsets), not a single canonical one.
- Keyboard: `Esc` clears selection; `Cmd+A` selects all in edit mode.

### 1.4 Page-scope defaults

`FlowMapView` already takes `color`, `pxPerWeight`, `refLat`, `defaults={view}`
props. Keep these as the **initial defaults** for the page. The Page Defaults
panel in the drawer lets the user override them at runtime; those overrides
are what get exported alongside the graph.

## Phase 2 — Bezier Handles (Two-DOF Per Node)

### 2.1 Math

For edge A→N ending at node N with pre-N control point `P_in`, and edge N→B
starting at N with post-N control point `P_out`:

- **G1 continuity** (smooth tangent direction): `P_in`, `N`, `P_out` collinear
  with N between them (`P_out = N + k·(N − P_in)` for some `k > 0`).
- **C1 continuity** (matched speeds): `|N − P_in| = |P_out − N|`.

For a through-node with equal handle lengths on both sides: 2 DOF per node —
**bearing** (the tangent direction) and **handle length** (the distance from
node to its adjacent control points).

For splits (N has N outputs): each outgoing handle can have its own length,
giving `1 + N` DOF (one shared incoming direction, N output lengths). Or
simplify: all outgoing handles share a length. Start with the simpler model.

For sources/sinks: only one side has a handle. Just bearing + one length.

### 2.2 Interaction

- Each selected node shows **two handles** (or one, for sources/sinks) on the
  bearing axis, opposite sides of the node.
- Handle position = node + bearing-vector × handleLen.
- **Drag endpoint of a handle** around the node to rotate bearing. Both
  handles stay collinear with the node (smooth-spline constraint).
- **Drag along the bearing axis** to change handle length. Both handles move
  symmetrically (equidistant constraint). Holding a modifier (e.g. `Alt`)
  breaks symmetry for asymmetric per-edge control.
- Visual: dashed line through the node showing the full tangent axis; filled
  dots at each handle endpoint.

### 2.3 Library changes

`directedBezier` currently takes start/end bearings and uses a fixed
control-point distance. Extend:

```ts
directedBezier(
  start, end,
  departBearing, arriveBearing,
  departHandleLen, arriveHandleLen,  // NEW — in screen-px, computed from node.style.handleLenOut / next node's handleLenIn
  n = 20,
  lngScaleFactor = 1,
)
```

Default handle length stays whatever the current behavior computes
(presumably a fraction of the chord length), so omitting the param is a
no-op from v1's perspective.

## Phase 3 — Per-Edge Color / Opacity / Width; Physical-Unit Widths

### 3.1 Per-edge styling

Once `SegmentStyle` (Phase 1.2) is on edges, the rendering code needs to emit
per-feature color/opacity in the GeoJSON output properties, not just a single
`color` field. This is mostly wiring — MapLibre's paint expressions already
read per-feature values via `['get', 'color']` etc.

### 3.2 Physical-unit widths

Add an alternative to `pxPerWeight`:

```ts
interface FlowGraphOpts {
  pxPerWeight?: number | ((w: number) => number)
  mPerWeight?: number   // NEW: meters of width per unit weight
}
```

When `mPerWeight` is set, convert to pixels per-frame using the current zoom
and refLat (standard web-mercator scaling). This makes a flow's width a
real-world scale — e.g. 10 m per weight unit means the ribbon always
represents physical lanes.

UI: radio toggle in Page Defaults ("width in: pixels / meters").

## Phase 4 — Node-Type Affordances + Richer Creation UX

### 4.1 Create-node palette

Double-click still creates a generic node. Add a **palette** (floating menu
on the map, triggered by e.g. right-click or a toolbar button) to drop
typed nodes:

- **Source** — will receive an output edge; no inputs expected.
- **Sink** — will receive an input edge; no outputs expected.
- **Through-node** — pass-through (single in, single out).
- **Split** — 1-in, multi-out.
- **Merge** — multi-in, 1-out.

The graph shape is still determined by edges, not node type; the palette is
just an affordance to skip thinking about `bearing` (auto-derived for each
type) and to hint downstream interactions.

### 4.2 Edge-click to insert waypoint

Click an existing edge at a point → split the edge in two, inserting a
through-node at the click position with auto-bearing along the edge tangent.

### 4.3 Flow-conservation weights

Edge weights can be **explicit** (user-set) or **auto** (derived from
upstream). Rules:

- **Source → first edge**: explicit weight.
- **Through-node output**: always = through-node input weight.
- **Merge output**: always = sum of input weights.
- **Split outputs**: user-set weights that must sum to input. Editing one
  changes the others proportionally, or the "remainder" is distributed
  evenly among unedited outputs. Consider a constraint-solver approach.

Data model:

```ts
interface GFlowEdge {
  from: string; to: string
  weight: number | 'auto'   // 'auto' = derive from topology
  style?: SegmentStyle
}
```

`computeLayout` runs a pre-pass resolving `'auto'` weights via topological
sort on the DAG. Cycles or unresolvable cases (e.g. no source provides a
starting weight) produce a validation error.

### 4.4 Drawer node/edge creation UX

When a source or sink is selected:

- "Add outgoing edge" / "Add incoming edge" button.
- After click, drawer shows a list of candidate destination nodes (or
  "Create new → drop on map").

## Phase 5 — Scene Round-Trip (YAML/JSON)

### 5.1 Export

Today's export (`cmd+shift+e`) dumps JSON with `graph + opts + view`. Extend to:

- Include per-segment `style` overrides.
- Optionally emit YAML instead of JSON (prettier for humans to paste into
  TS source). Action "Copy scene as YAML" / "Copy scene as JSON".
- Output minimizes diffs — sort nodes/edges by id, strip null/default values.

### 5.2 Paste into code

The exported format should be directly pastable as a `FlowGraph` literal
(TypeScript) with an optional `SceneDefaults` companion:

```ts
// site/src/examples/MyExample.tsx
import type { Scene } from 'geo-sankey'

const scene: Scene = {
  graph: {
    nodes: [
      { id: 'a', pos: [40.735, -74.055], label: 'Origin' },
      // ...
    ],
    edges: [
      { from: 'a', to: 'b', weight: 30 },
      // ...
    ],
  },
  opts: { color: '#14B8A6', mPerWeight: 5 },
  view: { lat: 40.740, lng: -74.020, zoom: 13 },
}
```

Make the export output valid TS (comma-trailing, 2-space indent) so it
round-trips without reformatting.

### 5.3 Imports from pasted text

An "Import scene (paste)" action prompts for YAML/JSON/TS literal text and
parses it. Useful for quickly trying a scene without a file download.

## Non-Goals / Out-of-Scope

- Custom bezier curves beyond smooth-spline (e.g. arbitrary 4-point curves,
  non-smooth corners). The constraint keeps the UI simple and the
  interpretation unambiguous.
- Animation / timeline editing.
- Collaboration / multi-user concurrency.

## Phasing Rationale

- **P1 (drawer + multi-select + defaults)** unblocks everything else: it's the
  editing surface for all future per-segment controls.
- **P2 (bezier handles)** is a self-contained geometry improvement that
  benefits from P1's property-drawer infrastructure.
- **P3 (per-edge styling + physical units)** is mostly wiring once P1/P2 exist.
- **P4 (node-type palette + auto weights)** polishes the creation flow once
  the editing flow is solid.
- **P5 (scene round-trip)** is the payoff: users can construct diagrams
  interactively and commit the result as code.
