# geo-sankey

Pure-geometry library for geographic flow maps: width-proportional ribbon arrows with merge/split tree layout.

Given user-specified positions, bearings, and weights, `geo-sankey` computes ribbon polygon geometry and outputs GeoJSON Features. No rendering dependencies (no React, MapLibre, D3, etc.).

## Install

```bash
pnpm add geo-sankey
```

## Usage

```ts
import { renderFlows, type FlowTree } from 'geo-sankey'

const trees: FlowTree[] = [
  {
    dest: 'Downtown',
    destPos: [40.71, -74.01],
    root: {
      type: 'merge',
      pos: [40.72, -74.03],
      bearing: 90,
      children: [
        { type: 'source', label: 'Terminal A', pos: [40.73, -74.04], weight: 0.6 },
        { type: 'source', label: 'Terminal B', pos: [40.71, -74.04], weight: 0.4 },
      ],
    },
  },
]

const fc = renderFlows(trees, {
  refLat: 40.72,
  zoom: 12,
  geoScale: 1,
  color: '#3388ff',
  key: 'my-flow',
  pxPerWeight: w => w * 30,
  arrowWing: 1.8,
  arrowLen: 1.2,
})
// fc is a GeoJSON FeatureCollection of Polygon features
```

## Prior & Related Art

### Terminology

- **Flow map** is the established cartographic term, dating to Charles Joseph Minard's work in the 1840s.
- **Sankey map** appears in academic literature (e.g. "Visualizing water infrastructure with Sankey maps", Journal of Maps, 2018) for geographically-placed Sankey diagrams.
- **Distributive flow map** refers specifically to the merge/split tree variant where tributaries combine into wider trunks.

### Existing libraries

| Library | Approach | Differences from geo-sankey |
|---|---|---|
| [flowmap.gl] (visgl) | deck.gl origin-destination flow lines | No merge/split trees, no width-proportional ribbons |
| [spatialsankey] | D3/Leaflet straight weighted lines | Straight lines only, no curved ribbons |
| [Transitive.js] (Conveyal) | Parallel transit route rendering | Schematic routes, no width-proportional ribbons |
| [d3-sankey] | Node-link Sankey diagrams | Not geographic |
| [kepler.gl] | General geo-visualization | No ribbon geometry primitives |
| deck.gl [ArcLayer] | Arcs between points | Arcs, not ribbons; no merge trees |

### Academic references

- "Flow Map Layout" — Phan et al., Stanford, InfoVis 2005
- "Flow Map Layout via Spiral Trees" — Buchin et al., IEEE TVCG 2011
- "Visualizing water infrastructure with Sankey maps" — Journal of Maps, 2018

### Transit map libraries

- [d3-tube-map] — schematic tube/metro maps
- [transit-map] (juliuste) — SVG transit maps

[flowmap.gl]: https://github.com/visgl/flowmap.gl
[spatialsankey]: https://github.com/nicholasjprimianomd/spatialsankey
[Transitive.js]: https://github.com/conveyal/transitive.js
[d3-sankey]: https://github.com/d3/d3-sankey
[kepler.gl]: https://kepler.gl
[ArcLayer]: https://deck.gl/docs/api-reference/layers/arc-layer
[d3-tube-map]: https://github.com/johnwalley/d3-tube-map
[transit-map]: https://github.com/juliuste/transit-map
