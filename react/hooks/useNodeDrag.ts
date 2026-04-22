import { useState, useEffect, useRef, useCallback } from 'react'
import type { FlowGraph } from 'geo-sankey'
import type { UseGraphState } from './useGraphState'
import type { UseGraphSelection } from './useGraphSelection'

export interface UseNodeDrag {
  /** Pass as `onMouseDown` to MapGL. */
  onDragStart: (e: any) => void
  /** Node id currently being dragged, or null. */
  dragging: string | null
  /** Props to spread on MapGL: `{ dragPan: !dragging }`. */
  dragPan: boolean
}

export function useNodeDrag(
  mapRef: React.RefObject<any>,
  gs: UseGraphState,
  sel: UseGraphSelection,
): UseNodeDrag {
  const [dragging, setDragging] = useState<string | null>(null)

  const graphRef = useRef(gs.graph)
  graphRef.current = gs.graph

  const onDragStart = useCallback((e: any) => {
    const nodeFeatures = e.features?.filter((f: any) => f.layer?.id === 'node-circles')
    if (nodeFeatures?.length) {
      setDragging(nodeFeatures[0].properties.id)
    }
  }, [])

  useEffect(() => {
    if (!dragging || !mapRef.current) return
    const map = mapRef.current.getMap()
    const canvas = map.getCanvas()
    canvas.style.cursor = 'grabbing'
    const preDrag = graphRef.current
    const selIds = sel.selections.filter(r => r.type === 'node').map(r => r.id)
    const moveIds = selIds.includes(dragging) && selIds.length > 1 ? selIds : [dragging]
    const origin = new Map<string, [number, number]>()
    for (const id of moveIds) {
      const n = preDrag.nodes.find(x => x.id === id)
      if (n) origin.set(id, [n.pos[0], n.pos[1]])
    }
    const anchor = origin.get(dragging)!
    let moved = false
    const onMove = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const { lng, lat } = map.unproject([ev.clientX - rect.left, ev.clientY - rect.top])
      const dLat = lat - anchor[0]
      const dLon = lng - anchor[1]
      if (!moved) { gs.pushHistory(preDrag); moved = true }
      gs.setGraph(g => ({
        ...g,
        nodes: g.nodes.map(n => {
          const start = origin.get(n.id)
          return start ? { ...n, pos: [start[0] + dLat, start[1] + dLon] as [number, number] } : n
        }),
      }))
    }
    const onUp = () => {
      setDragging(null)
      canvas.style.cursor = ''
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      canvas.style.cursor = ''
    }
  }, [dragging, sel.selections, gs.setGraph, gs.pushHistory, mapRef])

  return { onDragStart, dragging, dragPan: !dragging }
}
