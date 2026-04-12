export type LatLon = [number, number]  // [lat, lon]

export type FlowNode =
  | { type: 'source'; label: string; pos: LatLon; weight: number; bearing?: number }
  | { type: 'merge'; pos: LatLon; bearing: number; children: FlowNode[] }
  | { type: 'split'; pos: LatLon; bearing: number; children: FlowNode[] }

export interface FlowTree {
  dest: string
  destPos: LatLon
  root: FlowNode
}

export interface RibbonProperties {
  color: string
  width: number
  key: string
  opacity: number
  /** Edge source node id (only set on edge ribbons). */
  from?: string
  /** Edge destination node id (only set on edge ribbons). */
  to?: string
}

export interface GeoOpts {
  refLat: number
  zoom: number
  geoScale: number
}
