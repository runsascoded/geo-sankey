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

## Export

- Omnibar action: "Export scene" (keyboard shortcut `mod+e`)
- Produces JSON, downloaded as `<graph-name>.json` or copied to clipboard
- Option to export just the graph (no opts/view) for embedding

## Import

- Omnibar action: "Import scene" (keyboard shortcut `mod+i`)
- File picker or paste JSON
- Validates schema, replaces current graph + opts + view
- Error handling: show validation errors, don't replace on failure

## URL Sharing

Consider encoding small graphs in the URL hash (base64-compressed JSON) for link sharing without file exchange. For large graphs, URL contains a reference to a hosted JSON file.

## Implementation Notes

- Export: `JSON.stringify` the graph + opts + current viewport
- Import: `JSON.parse`, validate with runtime type checks, set state
- File download: create `<a>` with `data:` URL and `.click()`
- File upload: `<input type="file">` triggered by omnibar action
- Clipboard: `navigator.clipboard.writeText/readText`
