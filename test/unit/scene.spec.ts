import { describe, it, expect } from 'vitest'
import { sceneToTS, parseScene, type Scene } from '../../site/src/scene'

const sample: Scene = {
  graph: {
    nodes: [
      { id: 'b', pos: [40.7, -74.0] },
      { id: 'a', pos: [40.71, -74.01], label: 'Origin' },
    ],
    edges: [
      { from: 'a', to: 'b', weight: 'auto' },
    ],
  },
  view: { lat: 40.7, lng: -74.0, zoom: 12 },
}

describe('sceneToTS', () => {
  it('sorts nodes alphabetically by id', () => {
    const ts = sceneToTS(sample)
    const aIdx = ts.indexOf("id: 'a'")
    const bIdx = ts.indexOf("id: 'b'")
    expect(aIdx).toBeGreaterThan(0)
    expect(bIdx).toBeGreaterThan(aIdx)
  })

  it('omits undefined fields', () => {
    const ts = sceneToTS(sample)
    expect(ts).not.toContain('bearing')
    expect(ts).not.toContain('velocity')
  })

  it('uses single-quoted strings and unquoted keys', () => {
    const ts = sceneToTS(sample)
    expect(ts).toMatch(/id: 'a'/)
    expect(ts).toMatch(/from: 'a'/)
    expect(ts).toMatch(/weight: 'auto'/)
  })

  it('inlines primitive arrays', () => {
    const ts = sceneToTS(sample)
    expect(ts).toMatch(/pos: \[40\.71?,? -74\.01?\]/)
  })
})

describe('parseScene', () => {
  it('round-trips through sceneToTS', () => {
    const ts = sceneToTS(sample)
    const parsed = parseScene(ts)
    expect(parsed.graph.nodes).toHaveLength(2)
    expect(parsed.graph.nodes.find(n => n.id === 'a')?.label).toBe('Origin')
    expect(parsed.graph.edges[0]).toEqual({ from: 'a', to: 'b', weight: 'auto' })
    expect(parsed.view).toEqual({ lat: 40.7, lng: -74.0, zoom: 12 })
  })

  it('parses strict JSON', () => {
    const json = JSON.stringify(sample)
    const parsed = parseScene(json)
    expect(parsed.graph.nodes).toHaveLength(2)
  })

  it('strips a leading `const x: T = ` and trailing semicolon', () => {
    const wrapped = `const scene: Scene = ${sceneToTS(sample)};`
    const parsed = parseScene(wrapped)
    expect(parsed.graph.edges[0].weight).toBe('auto')
  })

  it('throws on input that is not a Scene', () => {
    expect(() => parseScene("{ foo: 'bar' }")).toThrow(/Scene/)
  })
})
