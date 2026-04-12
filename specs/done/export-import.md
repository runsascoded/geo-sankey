# Export / Import Scenes

Serialize and deserialize `FlowGraph` + rendering options as JSON for sharing, saving, and loading flow diagrams.

## Export Format

```jsonc
{
  "version": 1,
  "graph": {
    "nodes": [
      { "id": "hob-so", "pos": [40.7359, -74.0320], "bearing": 90, "label": "Hob So" },
      // ...
    ],
    "edges": [
      { "from": "hob-so", "to": "hob-split", "weight": 30 },
      // ...
    ]
  },
  "opts": {
    "color": "#14B8A6",
    "pxPerWeight": 0.15,
    "refLat": 40.740,
    "wing": 0.3,
    "angle": 45,
    "bezierN": 20,
    "nodeApproach": 0.5
  },
  "view": {
    "lat": 40.740,
    "lng": -74.020,
    "zoom": 13
  }
}
```

- `version`: schema version for forward compatibility
- `graph`: the `FlowGraph` object (nodes + edges)
- `opts`: rendering options (subset of `FlowGraphOpts`)
- `view`: map viewport (optional, for restoring camera position)

## Shipped

### Export
- Omnibar action: "Export scene" (keyboard shortcut `cmd+shift+e` / `ctrl+shift+e`)
- Produces JSON, downloaded as `<title>.json`

### Import
- Omnibar action: "Import scene" (keyboard shortcut `cmd+i` / `ctrl+i`)
- File picker triggered by the omnibar action
- Validates graph shape (nodes+edges present), replaces current graph
- Optional opts + view in the file are applied when present

## Deferred

- Clipboard copy/paste (`navigator.clipboard.*`)
- Graph-only export (no opts/view) for embedding
- URL hash encoding for link-sharing small graphs
- Detailed validation-error surfacing (current: logs to console, silently no-ops on malformed JSON)

## Implementation Notes

- Export: `JSON.stringify` the graph + opts + current viewport
- Import: `JSON.parse`, validate with runtime type checks, set state
- File download: create `<a>` with `data:` URL and `.click()`
- File upload: `<input type="file">` triggered by omnibar action
- Clipboard: `navigator.clipboard.writeText/readText`
