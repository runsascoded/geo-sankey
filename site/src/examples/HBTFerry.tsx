import type { FlowGraph } from 'geo-sankey'
import FlowMapView from '../FlowMapView'

const graph: FlowGraph = {
  nodes: [
    { id: 'bpt',       pos: [40.71500873644837, -74.01763141805306], bearing: 100, label: 'Brookfield Place' },
    { id: 'dt-merge',  pos: [40.715562912131446, -74.02118470868655], bearing: 104 },
    { id: 'hob-14',    pos: [40.75391277970118, -74.0231608871139], bearing: 100, velocity: 0.007159651779943488, label: 'Hob 14th' },
    { id: 'hob-so',    pos: [40.73536254629653, -74.02793860498223], bearing: 104, velocity: 0.002403020923443469, label: 'Hob So' },
    { id: 'hob-split', pos: [40.73492379942883, -74.0255833826839], bearing: 101 },
    { id: 'mt-merge',  pos: [40.75994551185576, -74.00787150192113], bearing: 110 },
    { id: 'mt39',      pos: [40.7574314723291, -73.99965492075728], bearing: 110, label: 'MT 39th St' },
    { id: 'ph',        pos: [40.71386196262006, -74.03248345388602], bearing: 100, label: 'Paulus Hook' },
    { id: 'ut-merge',  pos: [40.75667266380634, -74.01384177043765], bearing: 30 },
    { id: 'whk',       pos: [40.77684409809737, -74.01108054584255], bearing: 116, velocity: 0.013192930858358846, label: 'Weehawken' },
  ],
  edges: [
    { from: 'dt-merge', to: 'bpt', weight: 'auto' },
    { from: 'hob-14', to: 'ut-merge', weight: 20 },
    { from: 'hob-so', to: 'hob-split', weight: 30 },
    { from: 'hob-split', to: 'dt-merge', weight: 15 },
    { from: 'hob-split', to: 'ut-merge', weight: 15 },
    { from: 'mt-merge', to: 'mt39', weight: 'auto' },
    { from: 'ph', to: 'dt-merge', weight: 20 },
    { from: 'ut-merge', to: 'mt-merge', weight: 'auto' },
    { from: 'whk', to: 'mt-merge', weight: 30 },
  ],
}

export default function HBTFerry() {
  return (
    <FlowMapView
      graph={graph}
      title="HBT Ferry Flows"
      description="Partial NY Waterway ferry network: Hoboken South splits to Midtown (MT 39th St) and Downtown (Brookfield Place)."
      color="#14B8A6"
      pxPerWeight={0.15}
      refLat={40.740}
      defaults={{ lat: 40.7449, lng: -74.0007, zoom: 13.07 }}
      defaultNodes={1}
    />
  )
}
