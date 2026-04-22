import { useUrlState } from 'use-prms'
import type { Param } from 'use-prms'
import type { FlowGraph } from 'geo-sankey'
import FlowMapView from '../FlowMapView'

const demoGraph: FlowGraph = {
  nodes: [
    { id: 'origin', pos: [40.735, -74.055], bearing: 90, label: 'Origin' },
    { id: 'split',  pos: [40.735, -74.045], bearing: 90 },
    { id: 'merge',  pos: [40.735, -74.020], bearing: 90 },
    { id: 'dest',   pos: [40.735, -74.000], bearing: 90, label: 'Destination' },
    { id: 'north',  pos: [40.748, -74.038], bearing: 150, label: 'North' },
    { id: 'south',  pos: [40.720, -74.038], bearing: 30, label: 'South' },
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
      <section className="about-hero">
        <h2>Width-proportional flow ribbons on geographic maps.</h2>
        <p>
          geo-sankey is a pure-geometry TypeScript library that renders Sankey-style flow ribbons
          on real maps — with merge/split layout, arrowheads, and cubic-bezier curves that follow
          per-node bearings. Output is GeoJSON; bring your own map renderer (MapLibre, Mapbox,
          Leaflet, deck.gl).
        </p>
        <div className="about-cta">
          <a href="https://github.com/runsascoded/geo-sankey" target="_blank" rel="noreferrer">
            GitHub →
          </a>
          <a href="https://www.npmjs.com/package/geo-sankey" target="_blank" rel="noreferrer">
            npm →
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
            defaults={{ lat: 40.7327, lng: -74.0244, zoom: 13.69 }}
            defaultNodes={1}
          />
        </div>
        <p className="about-caption">
          Click a node to edit it. Drag the teal handle to change bearing + curve tightness.
          Double-click a ribbon to split an edge. Undo/redo with <kbd>⌘Z</kbd> / <kbd>⌘⇧Z</kbd>.
        </p>
      </section>

      <section className="about-usage">
        <h3>Install</h3>
        <pre><code>pnpm add geo-sankey</code></pre>
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
  )
}
