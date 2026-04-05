# Editable Mode

Interactive graph editor for the demo site. Users can create, modify, and manipulate flow graphs directly on the map.

## Node Operations

- **Create**: click on map to place a new node
- **Drag**: click-drag existing node to reposition
- **Edit properties**: click node to open panel with:
  - `id` / `label` (text)
  - `bearing` (degrees, or "auto" for auto-derived)
  - `pos` (lat/lon, editable or set by drag)
- **Delete**: right-click or delete key

## Edge Operations

- **Create**: click source node, then click dest node to add edge
- **Edit properties**: click edge to open panel with:
  - `weight` (number)
  - `color` (optional per-edge override)
- **Split bezier**: click a point on an existing edge to insert a waypoint node, splitting one edge into two
- **Delete**: right-click or select + delete

## UI

- Toggle edit mode via toolbar button or keyboard shortcut (`e`)
- When edit mode is active:
  - Nodes show drag handles
  - Hovering an edge highlights it
  - Click-on-map creates a node (unless dragging)
  - Selected node/edge shows property panel (sidebar or popover)
- Property changes immediately re-render the flow
- Undo/redo (Cmd+Z / Cmd+Shift+Z) via action history

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
