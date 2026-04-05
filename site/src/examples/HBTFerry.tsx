import type { FlowGraph } from 'geo-sankey'
import FlowMapView from '../FlowMapView'

const graph: FlowGraph = {
  nodes: [
    { id: 'hob-so',    pos: [40.7359, -74.0320], bearing: 90, label: 'Hob So' },
    { id: 'hob-14',    pos: [40.7520, -74.0280], bearing: 90, label: 'Hob 14th' },
    { id: 'whk',       pos: [40.7771, -74.0160], bearing: 130, label: 'Weehawken' },
    { id: 'ph',        pos: [40.7100, -74.0380], bearing: 60, label: 'Port Hamilton' },
    { id: 'hob-split', pos: [40.7359, -74.0240], bearing: 90 },
    { id: 'ut-merge',  pos: [40.7530, -74.0190], bearing: 30 },
    { id: 'dt-merge',  pos: [40.7100, -74.0240], bearing: 90 },
    { id: 'mt-merge',  pos: [40.7590, -74.0080], bearing: 110 },
    { id: 'mt39',      pos: [40.7570, -73.9980], bearing: 110, label: 'MT 39th St' },
    { id: 'bpt',       pos: [40.7100, -74.0140], bearing: 90, label: 'Brookfield' },
  ],
  edges: [
    { from: 'hob-so', to: 'hob-split', weight: 30 },
    { from: 'hob-split', to: 'ut-merge', weight: 15 },
    { from: 'hob-split', to: 'dt-merge', weight: 15 },
    { from: 'hob-14', to: 'ut-merge', weight: 20 },
    { from: 'ut-merge', to: 'mt-merge', weight: 35 },
    { from: 'whk', to: 'mt-merge', weight: 30 },
    { from: 'mt-merge', to: 'mt39', weight: 65 },
    { from: 'ph', to: 'dt-merge', weight: 20 },
    { from: 'dt-merge', to: 'bpt', weight: 35 },
  ],
}

export default function HBTFerry() {
  return (
    <FlowMapView
      graph={graph}
      title="HBT Ferry Flows"
      description="Full Hudson ferry network: Hob So splits to uptown (MT39) and downtown (Brookfield)."
      color="#14B8A6"
      pxPerWeight={0.15}
      refLat={40.740}
      defaults={{ lat: 40.740, lng: -74.020, zoom: 13 }}
    />
  )
}
