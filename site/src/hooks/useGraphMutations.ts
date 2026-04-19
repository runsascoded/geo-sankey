import { useCallback } from 'react'
import type { FlowGraph } from 'geo-sankey'
import type { UseGraphState } from './useGraphState'
import type { UseGraphSelection, SelectionRef } from './useGraphSelection'

export interface UseGraphMutations {
  renameNode: (oldId: string, newId: string) => void
  duplicateNodes: (ids: string[]) => void
  updateNode: (id: string, patch: Partial<{ pos: [number, number]; bearing: number; label: string; velocity: number }>) => void
  addNode: (pos: [number, number]) => void
  deleteNode: (id: string) => void
  addEdge: (from: string, to: string) => void
  updateEdge: (from: string, to: string, patch: Partial<{ weight: number | 'auto' }>) => void
  updateEdgeStyle: (from: string, to: string, patch: Partial<{ color: string; opacity: number; widthScale: number }>) => void
  deleteEdge: (from: string, to: string) => void
  reverseEdge: (from: string, to: string) => void
  splitEdgeAt: (from: string, to: string, pos: [number, number]) => void
  applyEdgeStyle: (patch: Partial<{ color: string; opacity: number; widthScale: number }>) => void
  applyEdgeWeight: (weight: number | 'auto') => void
}

export function useGraphMutations(
  gs: UseGraphState,
  sel: UseGraphSelection,
): UseGraphMutations {
  const { pushGraph } = gs
  const { setSelections, selectedEdges } = sel

  const renameNode = useCallback((oldId: string, newId: string) => {
    if (!newId || newId === oldId) return
    pushGraph(g => {
      if (g.nodes.some(n => n.id === newId)) return g
      return {
        nodes: g.nodes.map(n => n.id === oldId ? { ...n, id: newId } : n),
        edges: g.edges.map(e => ({
          ...e,
          from: e.from === oldId ? newId : e.from,
          to: e.to === oldId ? newId : e.to,
        })),
      }
    })
    setSelections(prev => prev.map(r =>
      r.type === 'node' && r.id === oldId ? { type: 'node', id: newId }
      : r.type === 'edge' && (r.from === oldId || r.to === oldId) ? {
        type: 'edge',
        from: r.from === oldId ? newId : r.from,
        to: r.to === oldId ? newId : r.to,
      }
      : r
    ))
  }, [pushGraph, setSelections])

  const duplicateNodes = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    const offset = 0.001
    const ts = Date.now().toString(36)
    const renames = new Map<string, string>(ids.map((id, i) => [id, `${id}-copy${ts}-${i}`]))
    pushGraph(g => {
      const newNodes = g.nodes.filter(n => idSet.has(n.id)).map(n => ({
        ...n,
        id: renames.get(n.id)!,
        pos: [n.pos[0] + offset, n.pos[1] + offset] as [number, number],
      }))
      const newEdges = g.edges
        .filter(e => idSet.has(e.from) && idSet.has(e.to))
        .map(e => ({ ...e, from: renames.get(e.from)!, to: renames.get(e.to)! }))
      return { nodes: [...g.nodes, ...newNodes], edges: [...g.edges, ...newEdges] }
    })
    setSelections([...renames.values()].map(id => ({ type: 'node' as const, id })))
  }, [pushGraph, setSelections])

  const updateNode = useCallback((id: string, patch: Partial<{ pos: [number, number]; bearing: number; label: string; velocity: number }>) => {
    pushGraph(g => ({
      ...g,
      nodes: g.nodes.map(n => n.id === id ? { ...n, ...patch } : n),
    }))
  }, [pushGraph])

  const addNode = useCallback((pos: [number, number]) => {
    const id = `n${Date.now()}`
    pushGraph(g => ({ ...g, nodes: [...g.nodes, { id, pos }] }))
    setSelections([{ type: 'node', id }])
  }, [pushGraph, setSelections])

  const deleteNode = useCallback((id: string) => {
    pushGraph(g => ({
      nodes: g.nodes.filter(n => n.id !== id),
      edges: g.edges.filter(e => e.from !== id && e.to !== id),
    }))
    setSelections(prev => prev.filter(r => !(r.type === 'node' && r.id === id)))
  }, [pushGraph, setSelections])

  const addEdge = useCallback((from: string, to: string) => {
    if (from === to) return
    pushGraph(g => {
      const fromHasInputs = g.edges.some(e => e.to === from)
      const weight: number | 'auto' = fromHasInputs ? 'auto' : 10
      return { ...g, edges: [...g.edges, { from, to, weight }] }
    })
    setSelections([{ type: 'edge', from, to }])
  }, [pushGraph, setSelections])

  const updateEdge = useCallback((from: string, to: string, patch: Partial<{ weight: number | 'auto' }>) => {
    pushGraph(g => ({
      ...g,
      edges: g.edges.map(e => e.from === from && e.to === to ? { ...e, ...patch } : e),
    }))
  }, [pushGraph])

  const updateEdgeStyle = useCallback((from: string, to: string, patch: Partial<{ color: string; opacity: number; widthScale: number }>) => {
    pushGraph(g => ({
      ...g,
      edges: g.edges.map(e => e.from === from && e.to === to
        ? { ...e, style: { ...e.style, ...patch } }
        : e),
    }))
  }, [pushGraph])

  const deleteEdge = useCallback((from: string, to: string) => {
    pushGraph(g => ({ ...g, edges: g.edges.filter(e => !(e.from === from && e.to === to)) }))
    setSelections(prev => prev.filter(r => !(r.type === 'edge' && r.from === from && r.to === to)))
  }, [pushGraph, setSelections])

  const reverseEdge = useCallback((from: string, to: string) => {
    pushGraph(g => {
      if (g.edges.some(e => e.from === to && e.to === from)) return g
      return {
        ...g,
        edges: g.edges.map(e => e.from === from && e.to === to
          ? { ...e, from: to, to: from }
          : e),
      }
    })
    setSelections([{ type: 'edge', from: to, to: from }])
  }, [pushGraph, setSelections])

  const splitEdgeAt = useCallback((from: string, to: string, pos: [number, number]) => {
    const id = `n${Date.now()}`
    pushGraph(g => {
      const e = g.edges.find(x => x.from === from && x.to === to)
      if (!e) return g
      const baseStyle = e.style
      const newNode = { id, pos }
      const firstHalf = { from, to: id, weight: e.weight, ...(baseStyle ? { style: baseStyle } : {}) }
      const secondHalf = { from: id, to, weight: 'auto' as const, ...(baseStyle ? { style: baseStyle } : {}) }
      return {
        nodes: [...g.nodes, newNode],
        edges: g.edges.flatMap(x => x === e ? [firstHalf, secondHalf] : [x]),
      }
    })
    setSelections([{ type: 'node', id }])
  }, [pushGraph, setSelections])

  const applyEdgeStyle = useCallback((patch: Partial<{ color: string; opacity: number; widthScale: number }>) => {
    for (const e of selectedEdges) updateEdgeStyle(e.from, e.to, patch)
  }, [selectedEdges, updateEdgeStyle])

  const applyEdgeWeight = useCallback((weight: number | 'auto') => {
    for (const e of selectedEdges) updateEdge(e.from, e.to, { weight })
  }, [selectedEdges, updateEdge])

  return {
    renameNode, duplicateNodes, updateNode, addNode, deleteNode,
    addEdge, updateEdge, updateEdgeStyle, deleteEdge, reverseEdge,
    splitEdgeAt, applyEdgeStyle, applyEdgeWeight,
  }
}
