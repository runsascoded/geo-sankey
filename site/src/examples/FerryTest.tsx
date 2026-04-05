import type { FlowGraph } from 'geo-sankey'
import FlowMapView from '../FlowMapView'

const graph: FlowGraph = {
  nodes: [
    { id: 'origin',  pos: [40.735, -74.055], bearing: 90, label: 'Origin' },
    { id: 'split',   pos: [40.735, -74.045], bearing: 90 },
    { id: 'merge',   pos: [40.735, -74.020], bearing: 90 },
    { id: 'dest',    pos: [40.735, -74.000], bearing: 90, label: 'Destination' },
    { id: 'north',   pos: [40.748, -74.038], bearing: 150, label: 'North' },
    { id: 'south',   pos: [40.720, -74.038], bearing: 30, label: 'South' },
  ],
  edges: [
    { from: 'origin', to: 'split', weight: 35 },
    { from: 'split', to: 'merge', weight: 20 },
    { from: 'split', to: 'south', weight: 15 },
    { from: 'north', to: 'merge', weight: 30 },
    { from: 'merge', to: 'dest', weight: 50 },
  ],
}

export default function FerryTest() {
  return (
    <FlowMapView
      graph={graph}
      title="Flow Graph Test"
      description="Graph-based flow rendering: origin splits, north merges, two sinks with arrowheads."
      color="#2563eb"
      pxPerWeight={0.3}
      refLat={40.735}
      defaults={{ lat: 40.735, lng: -74.030, zoom: 13 }}
    />
  )
}
