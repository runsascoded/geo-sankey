import { useMemo, useCallback } from 'react'
import Map, { Source, Layer } from 'react-map-gl/maplibre'
import { renderFlowTree } from 'geo-sankey'
import type { FlowTree, RenderFlowTreeOpts } from 'geo-sankey'
import { useLLZ } from '../llz'
import 'maplibre-gl/dist/maplibre-gl.css'

/** Three sources merge into one destination, with one intermediate merge node. */
const tree: FlowTree = {
  dest: 'Downtown',
  destPos: [40.720, -74.000],
  root: {
    type: 'merge',
    pos: [40.732, -74.012],
    bearing: 135, // SE toward destination
    children: [
      { type: 'source', label: 'North', pos: [40.745, -74.018], weight: 50 },
      {
        type: 'merge',
        pos: [40.738, -74.025],
        bearing: 80, // roughly east
        children: [
          { type: 'source', label: 'West A', pos: [40.743, -74.040], weight: 30 },
          { type: 'source', label: 'West B', pos: [40.733, -74.042], weight: 20 },
        ],
      },
    ],
  },
}

const DEFAULTS = { lat: 40.733, lng: -74.018, zoom: 13 }
const REF_LAT = 40.735

export default function BasicFlowTree() {
  const [llz, setLLZ] = useLLZ(DEFAULTS)

  const geojson = useMemo(() => {
    const opts: RenderFlowTreeOpts = {
      refLat: REF_LAT,
      zoom: llz.zoom,
      geoScale: 1,
      color: '#2563eb',
      key: 'basic',
      pxPerWeight: (w: number) => w * 0.12,
      arrowWing: 1.8,
      arrowLen: 1.2,
    }
    const features = renderFlowTree(tree, opts)
    return { type: 'FeatureCollection' as const, features }
  }, [llz.zoom])

  const onMove = useCallback((e: { viewState: { longitude: number; latitude: number; zoom: number } }) => {
    setLLZ({ lat: e.viewState.latitude, lng: e.viewState.longitude, zoom: e.viewState.zoom })
  }, [setLLZ])

  return (
    <div className="example">
      <h2>Basic Flow Tree</h2>
      <p>Three sources merge through an intermediate node into a single destination. Ribbon width is proportional to flow weight.</p>
      <div className="map-container">
        <Map
          initialViewState={{ longitude: llz.lng, latitude: llz.lat, zoom: llz.zoom }}
          style={{ width: '100%', height: '100%' }}
          mapStyle="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
          onMove={onMove}
        >
          <Source id="flow" type="geojson" data={geojson}>
            <Layer
              id="flow-fill"
              type="fill"
              paint={{
                'fill-color': ['get', 'color'],
                'fill-opacity': 0.85,
              }}
            />
            <Layer
              id="flow-outline"
              type="line"
              paint={{
                'line-color': ['get', 'color'],
                'line-width': 0.5,
                'line-opacity': 0.9,
              }}
            />
          </Source>
        </Map>
      </div>
    </div>
  )
}
