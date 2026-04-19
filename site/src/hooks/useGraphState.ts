import { useReducer, useCallback } from 'react'
import type { FlowGraph } from 'geo-sankey'

export type GraphAction =
  | { type: 'set'; next: FlowGraph | ((g: FlowGraph) => FlowGraph); history: boolean }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'pushHistory'; snapshot: FlowGraph }

interface GraphState { graph: FlowGraph; past: FlowGraph[]; future: FlowGraph[] }

function graphReducer(s: GraphState, a: GraphAction): GraphState {
  switch (a.type) {
    case 'set': {
      const next = typeof a.next === 'function' ? a.next(s.graph) : a.next
      if (!a.history) return { ...s, graph: next }
      if (next === s.graph) return s
      return { graph: next, past: [...s.past, s.graph], future: [] }
    }
    case 'pushHistory': {
      const last = s.past[s.past.length - 1]
      if (last === a.snapshot) return s
      return { ...s, past: [...s.past, a.snapshot], future: [] }
    }
    case 'undo': {
      if (s.past.length === 0) return s
      const prev = s.past[s.past.length - 1]
      return { graph: prev, past: s.past.slice(0, -1), future: [...s.future, s.graph] }
    }
    case 'redo': {
      if (s.future.length === 0) return s
      const next = s.future[s.future.length - 1]
      return { graph: next, past: [...s.past, s.graph], future: s.future.slice(0, -1) }
    }
  }
}

export interface UseGraphState {
  graph: FlowGraph
  setGraph: (next: FlowGraph | ((g: FlowGraph) => FlowGraph)) => void
  pushGraph: (next: FlowGraph | ((g: FlowGraph) => FlowGraph)) => void
  pushHistory: (snapshot: FlowGraph) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  pastLen: number
  futureLen: number
  dispatch: React.Dispatch<GraphAction>
}

export function useGraphState(initial: FlowGraph): UseGraphState {
  const [gs, dispatch] = useReducer(graphReducer, { graph: initial, past: [], future: [] })
  const setGraph = useCallback((next: FlowGraph | ((g: FlowGraph) => FlowGraph)) => {
    dispatch({ type: 'set', next, history: false })
  }, [])
  const pushGraph = useCallback((next: FlowGraph | ((g: FlowGraph) => FlowGraph)) => {
    dispatch({ type: 'set', next, history: true })
  }, [])
  const pushHistory = useCallback((snapshot: FlowGraph) => {
    dispatch({ type: 'pushHistory', snapshot })
  }, [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])
  return {
    graph: gs.graph,
    setGraph, pushGraph, pushHistory, undo, redo,
    canUndo: gs.past.length > 0,
    canRedo: gs.future.length > 0,
    pastLen: gs.past.length,
    futureLen: gs.future.length,
    dispatch,
  }
}
