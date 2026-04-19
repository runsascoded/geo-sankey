# Composable React Hooks for geo-sankey

> **Status (2026-04):** Phase 1 (extract hooks) and Phase 2 (promote to
> `geo-sankey/react` subpath) are **done**. Three hooks + reference
> components live in `react/`. Phase 3 (turnkey `<FlowEditor>` component)
> is deferred.

## Problem

All editing logic (graph state, undo/redo, selection, drag, split-edge,
rename, etc.) lived in `FlowMapView.tsx` — a ~1150-line component mixing
state, interaction, and rendering. Consumers who wanted to embed a
geo-sankey editor had no way to reuse the logic without copying wholesale.

## Goal

Expose the editing behavior as a composable set of React hooks that
consumers can adopt at different levels of abstraction:

- **Just geometry** — import `renderFlowGraph*` from `geo-sankey` (works
  today, no change).
- **State + undo** — add `useGraphState` for the graph + history machine.
- **State + selection** — add `useGraphSelection` for click/multi-select/
  role/aggregation helpers.
- **State + mutations** — add `useGraphMutations` for addNode, renameNode,
  splitEdge, etc.
- **Full turnkey** — the existing `FlowMapView` or a new `<FlowEditor>`
  that composes all the above + reference components (drawer, handles,
  paste modal).

Each layer is independently useful. A consumer who only wants
selection-on-click + a custom info panel doesn't need to import the
drawer or the mutation helpers.

## Package layout

```
geo-sankey/            (pure geometry — no React dependency)
  src/graph.ts         renderFlowGraph, resolveEdgeWeights, ...
  src/path.ts          directedBezier, ...
  src/index.ts         public API (unchanged)

geo-sankey/react       (new subpath export — React hooks + components)
  react/hooks/
    useGraphState.ts       graph + history + undo/redo
    useGraphSelection.ts   selection array + helpers
    useGraphMutations.ts   addNode, deleteNode, renameNode, ...
    useNodeDrag.ts         pointer→lat/lon, multi-select group drag
    useEdgeSource.ts       "add edge" modal state (guide-line, pick target)
    useSceneIO.ts          export/import/copy/paste (already extracted)
  react/components/
    SelectionSection.tsx   drawer content (already extracted)
    NodeOverlay.tsx        rotation + velocity handles (already exists)
    PasteModal.tsx         paste-import modal
    CopyToast.tsx          brief copy-success toast
  react/index.ts         re-exports everything
```

No separate npm package initially — use `package.json` `"exports"` map
to expose `geo-sankey/react` as a subpath. The main `geo-sankey` entry
stays framework-free.

## Hook API sketches

### `useGraphState(initial)`

```ts
interface UseGraphState {
  graph: FlowGraph
  /** Transient set (no history entry). Used during drag. */
  setGraph: (next: FlowGraph | ((g: FlowGraph) => FlowGraph)) => void
  /** Set with history push (one undo step). */
  pushGraph: (next: FlowGraph | ((g: FlowGraph) => FlowGraph)) => void
  /** Capture a snapshot for a future undo (call once at drag start). */
  pushHistory: (snapshot: FlowGraph) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  /** Raw dispatch for advanced use. */
  dispatch: React.Dispatch<GraphAction>
}
function useGraphState(initial: FlowGraph): UseGraphState
```

Internally wraps the existing `graphReducer`. Consumers get a
self-contained undo/redo machine they can use with any rendering.

### `useGraphSelection(graph)`

```ts
type SelectionRef =
  | { type: 'node'; id: string }
  | { type: 'edge'; from: string; to: string }

type NodeRole = 'source' | 'sink' | 'split' | 'merge' | 'through' | 'isolated'

interface UseGraphSelection {
  selections: SelectionRef[]
  setSelections: (next: SelectionRef[] | ((prev: SelectionRef[]) => SelectionRef[])) => void
  /** Primary selection (first in array). */
  selection: SelectionRef | null
  /** Toggle a ref in/out of the selection set (for shift-click). */
  toggleOrReplace: (ref: SelectionRef, shift: boolean) => void
  /** Resolved GFlowNode objects for selected nodes. */
  selectedNodes: GFlowNode[]
  /** Resolved GFlowEdge objects for selected edges. */
  selectedEdges: GFlowEdge[]
  /** Node IDs in selection (for map highlight). */
  selectedNodeIds: string[]
  /** Edge IDs in selection (for centerline highlight). */
  selectedEdgeIds: string[]
  /** Resolved numeric weights for all edges. */
  resolvedWeights: Map<string, number>
  /** Classify a node by its in/out degree. */
  nodeRoleOf: (id: string) => NodeRole
  /** Aggregate a field across selected edges. */
  aggEdge: <K extends string>(k: K, fromStyle?: boolean) => unknown
}
function useGraphSelection(
  graph: FlowGraph,
  opts?: { persist?: 'sessionStorage' | 'none' },
): UseGraphSelection
```

### `useGraphMutations(graphState, selectionState)`

```ts
interface UseGraphMutations {
  addNode: (pos: [number, number]) => void
  deleteNode: (id: string) => void
  renameNode: (oldId: string, newId: string) => void
  duplicateNodes: (ids: string[]) => void
  updateNode: (id: string, patch: Partial<GFlowNode>) => void
  addEdge: (from: string, to: string) => void
  deleteEdge: (from: string, to: string) => void
  reverseEdge: (from: string, to: string) => void
  updateEdge: (from: string, to: string, patch: Partial<GFlowEdge>) => void
  updateEdgeStyle: (from: string, to: string, patch: Partial<EdgeStyle>) => void
  applyEdgeWeight: (weight: number | 'auto') => void
  applyEdgeStyle: (patch: Partial<EdgeStyle>) => void
  splitEdgeAt: (from: string, to: string, pos: [number, number]) => void
}
function useGraphMutations(
  gs: UseGraphState,
  sel: UseGraphSelection,
): UseGraphMutations
```

Each mutation calls `gs.pushGraph` for undo-able changes and updates
`sel.setSelections` as appropriate (e.g. addNode auto-selects the new
node; renameNode re-points selection refs).

### `useNodeDrag(mapRef, graphState, selectionState)`

```ts
interface UseNodeDrag {
  /** Pass as `onMouseDown` to the MapGL component. */
  onDragStart: (e: MapMouseEvent) => void
  /** Whether a drag is in progress. */
  dragging: string | null
  /** Props to spread on MapGL to disable pan during drag. */
  mapProps: { dragPan: boolean }
}
function useNodeDrag(
  mapRef: React.RefObject<MapRef>,
  gs: UseGraphState,
  sel: UseGraphSelection,
): UseNodeDrag
```

Manages document-level mousemove/mouseup listeners, multi-node group
drag, and single-history-entry-per-drag.

### `useMapInteraction(mapRef, opts)`

```ts
interface MapInteractionOpts {
  editEnabled: boolean
  sel: UseGraphSelection
  mutations: UseGraphMutations
  drag: UseNodeDrag
  edgeSource: string | null
  setEdgeSource: (id: string | null) => void
}
interface UseMapInteraction {
  onClick: (e: MapMouseEvent) => void
  onDblClick: (e: MapMouseEvent) => void
  onHover: (e: MapMouseEvent) => void
  /** Layer IDs that should be interactive. */
  interactiveLayerIds: string[]
  /** Tooltip state (consumer decides how to render). */
  tooltip: { x: number; y: number; text: string } | null
  /** Cursor position for the add-edge guide-line. */
  cursor: { x: number; y: number } | null
}
function useMapInteraction(
  mapRef: React.RefObject<MapRef>,
  opts: MapInteractionOpts,
): UseMapInteraction
```

Wires click → selection, dbl-click → add-node-or-split-edge, hover →
tooltip state. Consumers render the tooltip however they want.

### `useSceneIO(...)` (already exists — just promote)

## Reference components

### `<NodeOverlay>` (already exists)

Shows rotation + velocity handles for a selected node. Consumers pass
the node, mapRef, and mutation callbacks. Already extracted.

### `<SelectionSection>` (already exists)

Drawer content for the current selection — node fields, edge fields,
weight input, add-edge dropdown, etc. Already extracted.

### `<FlowEditor>` (new — replaces FlowMapView as the turnkey entry)

```tsx
<FlowEditor
  initialGraph={graph}
  color="#14B8A6"
  pxPerWeight={0.15}
  refLat={40.740}
  defaults={{ lat: 40.74, lng: -74.01, zoom: 13 }}
  editEnabled={true}
/>
```

Composes all hooks + reference components + MapGL + drawer. Consumers
who want the full experience use this. `FlowMapView` becomes a thin
wrapper around `FlowEditor` (or merges into it).

## Implementation plan

### Phase 1: extract hooks from FlowMapView

Move existing logic into hook files under `site/src/hooks/`. The demo
site consumes them — validates the API shapes without package changes.

1. `useGraphState` — the reducer + undo/redo/push wrappers.
2. `useGraphSelection` — selections state + selectedNodes/Edges memos +
   resolvedWeights + nodeRoleOf + aggEdge.
3. `useGraphMutations` — every graph-mutating callback.
4. `useNodeDrag` — the dragging state + document-level listeners.
5. `useMapInteraction` — onClick/onDblClick/onHover + splitEdgeAt +
   interactiveLayerIds + tooltip + cursor.

Each extraction is a single commit: move code, wire up imports,
re-run tests.

### Phase 2: promote to `geo-sankey/react` subpath

1. Move hook files from `site/src/hooks/` → `react/hooks/`.
2. Move reference components from `site/src/` → `react/components/`.
3. Add `"./react"` to `package.json` `"exports"` map; add React as a
   `peerDependency`.
4. Update demo `site/` to import from `geo-sankey/react`.
5. Add `react/index.ts` barrel export.

### Phase 3: `<FlowEditor>` turnkey component

1. Compose all hooks + reference components into a single `<FlowEditor>`.
2. `FlowMapView` becomes a thin wrapper or is replaced.
3. Document the opt-in layers in the README.

## What NOT to do

- Don't refactor the core geometry lib (`src/`). It's already
  framework-free and well-structured.
- Don't add a MapLibre context provider yet. Threading `mapRef` as a
  prop is explicit and sufficient. Context is a v2 convenience.
- Don't abstract the drawer/slider/check components into a design
  system. They're intentionally minimal inline styles — consumers will
  bring their own UI kit.
- Don't try to make the hooks state-library-agnostic (Zustand, Jotai,
  etc.). React built-ins first; adapters later if demand exists.

## Verification

After each phase:
- `pnpm test` — all existing e2e + unit tests still pass.
- Dev server (`pnpm dev`) — the demo site renders and edits identically.
- TypeScript (`tsc --noEmit`) — no new type errors beyond pre-existing.
- Spot-check: import a single hook from `geo-sankey/react` in a fresh
  Vite project and confirm it resolves + renders.
