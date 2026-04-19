import { useState, useCallback, useMemo } from 'react'
import type { FlowGraph, GFlowNode, GFlowEdge } from 'geo-sankey'
import { resolveEdgeWeights } from 'geo-sankey'

export type SelectionRef =
  | { type: 'node'; id: string }
  | { type: 'edge'; from: string; to: string }

export type NodeRole = 'source' | 'sink' | 'split' | 'merge' | 'through' | 'isolated'

export function selRefEq(a: SelectionRef, b: SelectionRef): boolean {
  if (a.type !== b.type) return false
  if (a.type === 'node' && b.type === 'node') return a.id === b.id
  if (a.type === 'edge' && b.type === 'edge') return a.from === b.from && a.to === b.to
  return false
}

export interface UseGraphSelection {
  selections: SelectionRef[]
  setSelections: (next: SelectionRef[] | ((prev: SelectionRef[]) => SelectionRef[])) => void
  selection: SelectionRef | null
  toggleOrReplace: (ref: SelectionRef, shift: boolean) => void
  selectedNodes: GFlowNode[]
  selectedEdges: GFlowEdge[]
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  resolvedWeights: Map<string, number>
  nodeRoleOf: (id: string) => NodeRole
  aggEdge: (k: string, fromStyle?: boolean) => unknown
}

export function useGraphSelection(
  graph: FlowGraph,
  opts?: { persist?: 'sessionStorage' | 'none' },
): UseGraphSelection {
  const persist = opts?.persist ?? 'sessionStorage'

  const [selections, setSelectionsRaw] = useState<SelectionRef[]>(() => {
    if (persist === 'none') return []
    try {
      const s = sessionStorage.getItem('geo-sankey-sel')
      if (!s) return []
      const parsed = JSON.parse(s)
      if (Array.isArray(parsed)) return parsed
      return parsed ? [parsed] : []
    } catch { return [] }
  })

  const setSelections = useCallback((next: SelectionRef[] | ((prev: SelectionRef[]) => SelectionRef[])) => {
    setSelectionsRaw(prev => {
      const n = typeof next === 'function' ? next(prev) : next
      if (persist === 'sessionStorage') {
        sessionStorage.setItem('geo-sankey-sel', JSON.stringify(n))
      }
      return n
    })
  }, [persist])

  const selection = selections[0] ?? null

  const toggleOrReplace = useCallback((ref: SelectionRef, shift: boolean) => {
    if (shift) {
      setSelections(prev => prev.some(r => selRefEq(r, ref))
        ? prev.filter(r => !selRefEq(r, ref))
        : [...prev, ref])
    } else {
      setSelections([ref])
    }
  }, [setSelections])

  const selectedNodeIds = useMemo(
    () => selections.filter(r => r.type === 'node').map(r => r.id),
    [selections],
  )

  const selectedEdgeIds = useMemo(
    () => selections.filter(r => r.type === 'edge').map(r =>
      `${(r as Extract<SelectionRef, { type: 'edge' }>).from}->${(r as Extract<SelectionRef, { type: 'edge' }>).to}`),
    [selections],
  )

  const selectedNodes = useMemo(() => {
    const refs = selections.filter(r => r.type === 'node') as Extract<SelectionRef, { type: 'node' }>[]
    return refs.map(r => graph.nodes.find(n => n.id === r.id)!).filter(Boolean)
  }, [selections, graph.nodes])

  const selectedEdges = useMemo(() => {
    const refs = selections.filter(r => r.type === 'edge') as Extract<SelectionRef, { type: 'edge' }>[]
    return refs.map(r => graph.edges.find(e => e.from === r.from && e.to === r.to)!).filter(Boolean)
  }, [selections, graph.edges])

  const resolvedWeights = useMemo(() => resolveEdgeWeights(graph), [graph])

  const nodeRoleOf = useCallback((id: string): NodeRole => {
    let ins = 0, outs = 0
    for (const e of graph.edges) {
      if (e.to === id) ins++
      if (e.from === id) outs++
    }
    if (ins === 0 && outs === 0) return 'isolated'
    if (ins === 0) return 'source'
    if (outs === 0) return 'sink'
    if (outs > 1) return 'split'
    if (ins > 1) return 'merge'
    return 'through'
  }, [graph.edges])

  const aggEdge = useCallback((k: string, fromStyle?: boolean): unknown => {
    if (!selectedEdges.length) return undefined
    const getter = fromStyle
      ? (e: GFlowEdge) => (e.style as any)?.[k]
      : (e: GFlowEdge) => (e as any)[k]
    const first = getter(selectedEdges[0])
    return selectedEdges.every(e => getter(e) === first) ? first : undefined
  }, [selectedEdges])

  return {
    selections, setSelections, selection, toggleOrReplace,
    selectedNodes, selectedEdges, selectedNodeIds, selectedEdgeIds,
    resolvedWeights, nodeRoleOf, aggEdge,
  }
}
