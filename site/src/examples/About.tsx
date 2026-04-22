import { useUrlState } from 'use-prms'
import type { Param } from 'use-prms'
import type { FlowGraph } from 'geo-sankey'
import FlowMapView from '../FlowMapView'

const demoGraph: FlowGraph = {
  nodes: [
    { id: 'origin', pos: [40.72869892036732, -74.0439534308953],   bearing: 91, velocity: 0.012508781511632358, label: 'Source 2' },
    { id: 'north',  pos: [40.74868359047099, -74.03076560347449],  bearing: 90, velocity: 0.008303935794269104, label: 'Source 1' },
    { id: 'split',  pos: [40.728801949524666, -74.03307687219764], bearing: 90, velocity: 0.008157419023859802 },
    { id: 'merge',  pos: [40.73632264714735, -74.01513055034583],  bearing: 90 },
    { id: 'south',  pos: [40.7173647392369, -74.01377098050851],   bearing: 87, velocity: 0.011718460014870263, label: 'Destination 2' },
    { id: 'dest',   pos: [40.73632264714735, -73.99759209944546],  bearing: 90, label: 'Destination 1' },
  ],
  edges: [
    { from: 'origin', to: 'split', weight: 35 },
    { from: 'split', to: 'merge', weight: 20 },
    { from: 'split', to: 'south', weight: 15 },
    { from: 'north', to: 'merge', weight: 30 },
    { from: 'merge', to: 'dest', weight: 'auto' },
  ],
}

const exParam: Param<string> = { encode: v => v, decode: s => s ?? 'about' }

export default function About() {
  const [, setActive] = useUrlState('ex', exParam)
  return (
    <div className="about">
      <div className="about-inner">
      <section className="about-hero">
        <h2>Width-proportional flow maps.</h2>
        <p>
          geo-sankey is a pure-geometry TypeScript library for rendering flows on real maps, with
          merge/split layout, arrowheads, and cubic-bezier curves that follow per-node bearings.
          Output is GeoJSON; bring your own map renderer (MapLibre, Mapbox, Leaflet, deck.gl).
        </p>
        <div className="about-cta">
          <a href="https://github.com/runsascoded/geo-sankey" target="_blank" rel="noreferrer">
            GitHub →
          </a>
        </div>
      </section>

      <section className="about-demo">
        <div className="about-demo-map">
          <FlowMapView
            graph={demoGraph}
            title="About Demo"
            description=""
            color="#2563eb"
            pxPerWeight={0.3}
            refLat={40.735}
            defaults={{ lat: 40.7304, lng: -73.9996, zoom: 12.34 }}
            defaultNodes={2}
            initialOpts={{ wing: 0.65 }}
          />
        </div>
        <p className="about-caption">
          Click a node to edit it. Drag the teal handle to change bearing + curve tightness.
          Double-click a ribbon to split an edge. Undo/redo with <kbd>⌘Z</kbd> / <kbd>⌘⇧Z</kbd>.
        </p>
      </section>

      <section className="about-usage">
        <h3>Install</h3>
        <p>Not on npm yet — install from the <code>dist</code> branch:</p>
        <pre><code>pnpm add github:runsascoded/geo-sankey#dist</code></pre>
        <h3>Usage</h3>
        <pre><code>{`import { renderFlowGraphSinglePoly, type FlowGraph } from 'geo-sankey'

const graph: FlowGraph = {
  nodes: [
    { id: 'a', pos: [40.735, -74.055], bearing: 90, label: 'A' },
    { id: 'b', pos: [40.735, -74.000], bearing: 90, label: 'B' },
  ],
  edges: [{ from: 'a', to: 'b', weight: 35 }],
}

const fc = renderFlowGraphSinglePoly(graph, {
  refLat: 40.735, zoom: 13, color: '#2563eb', pxPerWeight: 0.3,
})
// fc is a GeoJSON FeatureCollection — pipe to your <Source>/<Layer>`}</code></pre>
        <p>
          For editing UIs, the <code>geo-sankey/react</code> subpath exports composable hooks
          (<code>useGraphState</code>, <code>useGraphMutations</code>, <code>useNodeDrag</code>,
          etc.) and reference components. See the <a href="https://github.com/runsascoded/geo-sankey#react-hooks-geo-sankeyreact"
          target="_blank" rel="noreferrer">README</a> for details.
        </p>
      </section>

      <section className="about-examples">
        <h3>More examples</h3>
        <ul>
          <li><a href="?ex=hbt" onClick={e => { e.preventDefault(); setActive('hbt') }}>HBT Ferry</a> — partial NY Waterway network with real lat/lon</li>
          <li><a href="?ex=ferry" onClick={e => { e.preventDefault(); setActive('ferry') }}>Simple Flow</a> — merge/split with debug overlays</li>
          <li><a href="?ex=seam-test" onClick={e => { e.preventDefault(); setActive('seam-test') }}>Seam Test</a> — opacity + single-poly comparison</li>
        </ul>
      </section>
      </div>
    </div>
  )
}
