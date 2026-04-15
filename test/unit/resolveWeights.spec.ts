import { describe, it, expect } from 'vitest'
import { resolveEdgeWeights, type FlowGraph } from '../../src/index'

const eid = (from: string, to: string) => `${from}→${to}`

describe('resolveEdgeWeights', () => {
  it('passes explicit numeric weights through unchanged', () => {
    const g: FlowGraph = {
      nodes: [{ id: 'a', pos: [0, 0] }, { id: 'b', pos: [0, 1] }],
      edges: [{ from: 'a', to: 'b', weight: 7 }],
    }
    const w = resolveEdgeWeights(g)
    expect(w.get(eid('a', 'b'))).toBe(7)
  })

  it('through-node propagates input weight to single auto output', () => {
    const g: FlowGraph = {
      nodes: [
        { id: 'src', pos: [0, 0] },
        { id: 'mid', pos: [0, 1] },
        { id: 'dst', pos: [0, 2] },
      ],
      edges: [
        { from: 'src', to: 'mid', weight: 5 },
        { from: 'mid', to: 'dst', weight: 'auto' },
      ],
    }
    const w = resolveEdgeWeights(g)
    expect(w.get(eid('mid', 'dst'))).toBe(5)
  })

  it('merge: single auto output equals sum of inputs', () => {
    const g: FlowGraph = {
      nodes: [
        { id: 'a', pos: [0, 0] }, { id: 'b', pos: [0, 1] },
        { id: 'm', pos: [0, 2] }, { id: 'd', pos: [0, 3] },
      ],
      edges: [
        { from: 'a', to: 'm', weight: 3 },
        { from: 'b', to: 'm', weight: 4 },
        { from: 'm', to: 'd', weight: 'auto' },
      ],
    }
    const w = resolveEdgeWeights(g)
    expect(w.get(eid('m', 'd'))).toBe(7)
  })

  it('split: auto outputs share input equally', () => {
    const g: FlowGraph = {
      nodes: [
        { id: 's', pos: [0, 0] }, { id: 'x', pos: [0, 1] },
        { id: 'a', pos: [1, 1] }, { id: 'b', pos: [-1, 1] },
      ],
      edges: [
        { from: 's', to: 'x', weight: 10 },
        { from: 'x', to: 'a', weight: 'auto' },
        { from: 'x', to: 'b', weight: 'auto' },
      ],
    }
    const w = resolveEdgeWeights(g)
    expect(w.get(eid('x', 'a'))).toBe(5)
    expect(w.get(eid('x', 'b'))).toBe(5)
  })

  it('split: auto outputs share remainder after explicit siblings', () => {
    const g: FlowGraph = {
      nodes: [
        { id: 's', pos: [0, 0] }, { id: 'x', pos: [0, 1] },
        { id: 'a', pos: [1, 1] }, { id: 'b', pos: [-1, 1] },
        { id: 'c', pos: [0, 2] },
      ],
      edges: [
        { from: 's', to: 'x', weight: 10 },
        { from: 'x', to: 'a', weight: 4 },
        { from: 'x', to: 'b', weight: 'auto' },
        { from: 'x', to: 'c', weight: 'auto' },
      ],
    }
    const w = resolveEdgeWeights(g)
    expect(w.get(eid('x', 'a'))).toBe(4)
    expect(w.get(eid('x', 'b'))).toBe(3)
    expect(w.get(eid('x', 'c'))).toBe(3)
  })

  it('multi-hop chain of auto edges resolves end-to-end', () => {
    const g: FlowGraph = {
      nodes: [
        { id: 'a', pos: [0, 0] },
        { id: 'b', pos: [0, 1] },
        { id: 'c', pos: [0, 2] },
        { id: 'd', pos: [0, 3] },
      ],
      edges: [
        { from: 'a', to: 'b', weight: 12 },
        { from: 'b', to: 'c', weight: 'auto' },
        { from: 'c', to: 'd', weight: 'auto' },
      ],
    }
    const w = resolveEdgeWeights(g)
    expect(w.get(eid('b', 'c'))).toBe(12)
    expect(w.get(eid('c', 'd'))).toBe(12)
  })
})
