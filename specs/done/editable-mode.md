# Editable Mode

Interactive graph editor for the demo site. Users can create, modify, and manipulate flow graphs directly on the map.

## Shipped

### Node operations
- **Create**: double-click empty map (single click would accidentally create nodes on every stray click)
- **Drag**: click-drag on the map canvas; a single history entry per drag
- **Select**: click a node (teal highlight + larger radius)
- **In-place property overlay**: floating panel follows the selected node on map pan/zoom
  - Label, Lat, Lon inputs (click overlay to expand)
  - Draggable **rotation handle** on the bearing axis; ghost arm previews on hover
  - Add-edge-from button, Delete button
- **Delete**: `Backspace` or `Delete`
- **Deselect**: click empty map

### Edge operations
- **Create**: select source node → "Add edge from" → click destination node
- **Select**: click a ring/graph-overlay edge
- **Edit**: weight input in edge panel
- **Delete**: `Backspace` or `Delete`

### UI
- Toggle edit mode: `e`
- Selected node highlighted on map
- Property panel floats near selected feature
- Property changes immediately re-render flows
- **Undo/redo**: `cmd+z` / `cmd+shift+z` (plus `ctrl+` equivalents for non-mac)

## Deferred (not blocking)

- Edge-click to insert a waypoint node (split one edge into two)
- Per-edge color override in UI (`NodeStyle` supports per-node color; edges do not)
- Explicit "auto" bearing UI toggle (current behaviour: omit `bearing` to auto-derive)
- Right-click delete (keyboard works)
- Hover highlight on edges

## Data Model

The editable state is the `FlowGraph` object (`{ nodes, edges }`). All edits mutate a React state holding the graph, triggering re-render. The graph is the single source of truth — no separate "edit state."

## Integration with Export/Import

Editable mode produces the same `FlowGraph` JSON that export/import uses. Editing a graph then exporting gives a portable scene file.

## Implementation Notes

- Use MapLibre's `onMouseDown`/`onMouseMove`/`onMouseUp` for drag
- Node creation: `onMapClick` when not on an existing feature
- Edge creation: two-click mode (click source, click dest)
- Property panel: floating div positioned near the selected feature
- Consider `@floating-ui/react` for panel positioning
