import { useState, useCallback } from 'react'
import type { UseGraphSelection } from './useGraphSelection'
import type { UseGraphMutations } from './useGraphMutations'

export interface UseMapInteraction {
  onClick: (e: any) => void
  onDblClick: (e: any) => void
  onHover: (e: any) => void
  tooltip: { x: number; y: number; text: string } | null
  cursor: { x: number; y: number } | null
  edgeSource: string | null
  setEdgeSource: (id: string | null) => void
  interactiveLayerIds: string[]
}

export function useMapInteraction(
  mapRef: React.RefObject<any>,
  sel: UseGraphSelection,
  mut: UseGraphMutations,
  opts?: {
    /** Extra layer IDs to include in interactiveLayerIds. */
    extraInteractiveLayers?: string[]
  },
): UseMapInteraction {
  const [edgeSource, setEdgeSource] = useState<string | null>(null)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

  const onClick = useCallback((e: any) => {
    const shift = (e.originalEvent as MouseEvent | undefined)?.shiftKey
    const nodeFeatures = e.features?.filter((f: any) => f.layer?.id === 'node-circles')
    const centerlineFeatures = e.features?.filter((f: any) => f.layer?.id === 'edge-centerlines-hit')
    const edgeFeatures = e.features?.filter((f: any) => f.layer?.id === 'flows-fill')

    if (nodeFeatures?.length) {
      const nodeId = nodeFeatures[0].properties.id
      if (edgeSource) {
        mut.addEdge(edgeSource, nodeId)
        setEdgeSource(null)
        return
      }
      sel.toggleOrReplace({ type: 'node', id: nodeId }, !!shift)
      return
    }
    if (centerlineFeatures?.length) {
      const p = centerlineFeatures[0].properties
      if (p.from && p.to) {
        sel.toggleOrReplace({ type: 'edge', from: p.from, to: p.to }, !!shift)
        return
      }
    }
    if (edgeFeatures?.length) {
      const p = edgeFeatures[0].properties
      if (p.from && p.to) {
        sel.toggleOrReplace({ type: 'edge', from: p.from, to: p.to }, !!shift)
        return
      }
    }
    if (edgeSource) setEdgeSource(null)
    if (!shift) sel.setSelections([])
  }, [edgeSource, mut.addEdge, sel.toggleOrReplace, sel.setSelections])

  const onDblClick = useCallback((e: any) => {
    e.preventDefault()
    const map = mapRef.current?.getMap()
    if (map) {
      const hits = map.queryRenderedFeatures([e.point.x, e.point.y], { layers: ['edge-centerlines-hit'] })
      if (hits?.length) {
        const p = hits[0].properties as { from?: string; to?: string }
        if (p.from && p.to) {
          mut.splitEdgeAt(p.from, p.to, [e.lngLat.lat, e.lngLat.lng])
          return
        }
      }
    }
    mut.addNode([e.lngLat.lat, e.lngLat.lng])
  }, [mapRef, mut.splitEdgeAt, mut.addNode])

  const onHover = useCallback((e: any) => {
    setCursor({ x: e.point.x, y: e.point.y })
    if (e.features?.length) {
      const f = e.features[0], p = f.properties
      // Nodes: label is already rendered by the node-labels symbol layer; skip tooltip.
      if (f.geometry?.type === 'Point') {
        setTooltip(null)
      } else if (p.bearing != null) {
        setTooltip({ x: e.point.x, y: e.point.y, text: `edge #${p.idx} bearing:${p.bearing}\u00B0\n${p.from} → ${p.to}` })
      }
    } else {
      setTooltip(null)
    }
  }, [])

  const interactiveLayerIds = [
    'node-circles',
    'flows-fill',
    'edge-centerlines-hit',
    ...(opts?.extraInteractiveLayers ?? []),
  ]

  return { onClick, onDblClick, onHover, tooltip, cursor, edgeSource, setEdgeSource, interactiveLayerIds }
}
